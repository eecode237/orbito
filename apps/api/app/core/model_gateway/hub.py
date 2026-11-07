"""Local model hub — discovery and lifecycle for Ollama.

This is the only place that talks to Ollama's management API (`/api/tags`,
`/api/pull`, ...). Generation stays in `providers/ollama.py` so the dashboard
can inspect a server even when generation is disabled.

Nothing here hardcodes a model: names come from the request, and the suggested
catalogue is advisory metadata rendered by the UI.
"""

from __future__ import annotations

import asyncio
import json
import os
import platform
import re
import shutil
import subprocess
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import httpx

from app.config import settings

# Registry names: `model`, `namespace/model`, and an optional `:tag`.
MODEL_NAME = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}(?::[A-Za-z0-9._-]{1,64})?$"
)

SUGGESTIONS: tuple[dict[str, str], ...] = (
    {
        "name": "qwen3.5:4b",
        "role": "General · vision · tools",
        "note": "Best balance for a 32 GB laptop without a discrete GPU.",
    },
    {
        "name": "qwen3.5:9b",
        "role": "Harder reasoning",
        "note": "Roughly half the speed of 4B; still fits in 32 GB.",
    },
    {
        "name": "qwen2.5-coder:7b",
        "role": "Dedicated coding",
        "note": "No thinking trace, which keeps agent turns short.",
    },
    {
        "name": "nomic-embed-text",
        "role": "Embeddings",
        "note": "Small embedding model for RAG and pgvector.",
    },
)


class ModelHubError(RuntimeError):
    """Ollama is unreachable or rejected a management request."""


def is_valid_model_name(name: str) -> bool:
    """Reject path traversal and whitespace before a name reaches Ollama."""
    return bool(MODEL_NAME.fullmatch(name.strip()))


class ModelHub:
    """Thin async client for Ollama's discovery and model endpoints."""

    name = "ollama"

    def __init__(
        self,
        base_url: str | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout: float = 10.0,
    ) -> None:
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self._transport = transport
        self._timeout = timeout

    def _client(self, timeout: Any = None) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self._timeout if timeout is None else timeout,
            transport=self._transport,
            follow_redirects=True,
        )

    @staticmethod
    def _error(exc: Exception) -> str:
        if isinstance(exc, httpx.ConnectError):
            return "Ollama is not running. Start it with `ollama serve`."
        if isinstance(exc, httpx.TimeoutException):
            return "Ollama did not respond in time."
        return f"Ollama request failed: {exc}"

    async def status(self, timeout: float = 3.0) -> dict[str, Any]:
        try:
            async with self._client(timeout) as client:
                response = await client.get("/api/version")
                response.raise_for_status()
                payload = response.json()
            return {
                "reachable": True,
                "version": payload.get("version"),
                "base_url": self.base_url,
                "error": None,
            }
        except Exception as exc:  # noqa: BLE001 - surfaced to the dashboard
            return {
                "reachable": False,
                "version": None,
                "base_url": self.base_url,
                "error": self._error(exc),
            }

    async def installed(self) -> list[dict[str, Any]]:
        payload = await self._get("/api/tags")
        return [self._model(row) for row in payload.get("models", [])]

    async def running(self) -> list[dict[str, Any]]:
        payload = await self._get("/api/ps")
        models: list[dict[str, Any]] = []
        for row in payload.get("models", []):
            size = int(row.get("size") or 0)
            vram = int(row.get("size_vram") or 0)
            if size and vram >= size * 0.99:
                processor = "gpu"
            elif vram:
                processor = "partial"
            else:
                processor = "cpu"
            models.append(
                {
                    **self._model(row),
                    "size_vram": vram,
                    "processor": processor,
                    "expires_at": row.get("expires_at"),
                    "context_length": row.get("context_length"),
                }
            )
        return models

    async def show(self, name: str) -> dict[str, Any]:
        name = name.strip()
        if not is_valid_model_name(name):
            raise ModelHubError("Invalid model name.")
        try:
            async with self._client() as client:
                response = await client.post("/api/show", json={"model": name})
                response.raise_for_status()
                payload = response.json()
        except ModelHubError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ModelHubError(self._error(exc)) from exc

        info = payload.get("model_info") or {}
        context = next(
            (value for key, value in info.items() if key.endswith(".context_length")),
            None,
        )
        return {
            "name": name,
            "details": payload.get("details") or {},
            "capabilities": payload.get("capabilities") or [],
            "context_length": context,
            "parameters": payload.get("parameters"),
            "modified_at": payload.get("modified_at"),
        }

    async def pull(self, name: str) -> AsyncIterator[dict[str, Any]]:
        """Stream download progress exactly as Ollama reports it."""
        name = name.strip()
        if not is_valid_model_name(name):
            raise ModelHubError("Invalid model name.")
        try:
            async with self._client(httpx.Timeout(None)) as client:
                async with client.stream(
                    "POST", "/api/pull", json={"model": name, "stream": True}
                ) as response:
                    if response.status_code >= 400:
                        body = (await response.aread()).decode(errors="ignore")[:300]
                        raise ModelHubError(f"Ollama refused the download: {body}")
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        yield self._progress(event)
        except ModelHubError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ModelHubError(self._error(exc)) from exc

    async def remove(self, name: str) -> bool:
        name = name.strip()
        if not is_valid_model_name(name):
            raise ModelHubError("Invalid model name.")
        try:
            async with self._client() as client:
                response = await client.request(
                    "DELETE", "/api/delete", json={"model": name}
                )
                if response.status_code == 404:
                    return False
                response.raise_for_status()
            return True
        except ModelHubError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ModelHubError(self._error(exc)) from exc

    async def hardware(self) -> dict[str, Any]:
        """Host resources, without assuming psutil is installed."""
        return await asyncio.to_thread(self._hardware_sync)

    async def _get(self, path: str) -> dict[str, Any]:
        try:
            async with self._client() as client:
                response = await client.get(path)
                response.raise_for_status()
                return response.json()
        except Exception as exc:  # noqa: BLE001
            raise ModelHubError(self._error(exc)) from exc

    async def search_library(self, query: str, limit: int = 20) -> dict[str, Any]:
        """Search the public Ollama library for models not yet installed locally.

        This is a best-effort remote lookup (ollama.com). It must never fabricate
        results; on network/API failure it returns an honest unavailable state.
        Downloads still happen via the local Ollama daemon (`/api/pull`), which
        stores models in Ollama's default model directory.
        """
        q = (query or "").strip()
        if not q:
            return {"reachable": True, "query": q, "results": [], "error": None}
        limit = max(1, min(int(limit or 20), 50))
        installed_names: set[str] = set()
        try:
            installed_names = {m.get("name", "") for m in await self.installed() if m.get("name")}
            # also match base names (without tag) for friendlier status
            installed_bases = {n.split(":", 1)[0] for n in installed_names}
        except Exception:  # noqa: BLE001
            installed_bases = set()

        payload: Any = None
        last_error: str | None = None
        endpoints = [
            ("https://ollama.com/api/search", {"q": q}),
            ("https://ollama.com/api/search", {"search": q}),
        ]
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            for url, params in endpoints:
                try:
                    resp = await client.get(url, params=params, headers={"Accept": "application/json"})
                    if resp.status_code == 404:
                        last_error = "Remote library search API is not available from this environment."
                        continue
                    resp.raise_for_status()
                    payload = resp.json()
                    last_error = None
                    break
                except Exception as exc:  # noqa: BLE001
                    last_error = f"Remote library search unavailable: {exc}"
                    payload = None

        if payload is None:
            return {"reachable": False, "query": q, "results": [], "error": last_error}

        raw = payload.get("models") if isinstance(payload, dict) else payload
        if not isinstance(raw, list):
            raw = []
        results: list[dict[str, Any]] = []
        for item in raw[:limit]:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or item.get("model") or "").strip()
            if not name:
                continue
            base = name.split(":", 1)[0]
            installed = name in installed_names or base in installed_bases
            results.append(
                {
                    "name": name,
                    "description": item.get("description") or item.get("summary") or "",
                    "pulls": item.get("pulls") or item.get("pull_count"),
                    "tags": item.get("tags") or item.get("sizes") or [],
                    "updated_at": item.get("updated_at") or item.get("last_updated"),
                    "installed": installed,
                }
            )
        return {"reachable": True, "query": q, "results": results, "error": None}

    @staticmethod
    def _model(row: dict[str, Any]) -> dict[str, Any]:
        details = row.get("details") or {}
        return {
            "name": row.get("name") or row.get("model"),
            "size": int(row.get("size") or 0),
            "digest": row.get("digest"),
            "modified_at": row.get("modified_at"),
            "family": details.get("family"),
            "parameter_size": details.get("parameter_size"),
            "quantization": details.get("quantization_level"),
            "format": details.get("format"),
        }

    @staticmethod
    def _progress(event: dict[str, Any]) -> dict[str, Any]:
        total = int(event.get("total") or 0)
        completed = int(event.get("completed") or 0)
        percent = round(completed / total * 100, 1) if total else None
        return {
            "status": event.get("status") or "working",
            "digest": event.get("digest"),
            "total": total,
            "completed": completed,
            "percent": percent,
        }

    @staticmethod
    def _hardware_sync() -> dict[str, Any]:
        memory: dict[str, int] = {}
        try:
            for line in Path("/proc/meminfo").read_text().splitlines():
                key, _, rest = line.partition(":")
                parts = rest.strip().split()
                if parts:
                    memory[key] = int(parts[0]) * 1024
        except (OSError, ValueError):
            pass

        cpu_model = platform.processor() or None
        try:
            for line in Path("/proc/cpuinfo").read_text().splitlines():
                if line.lower().startswith("model name"):
                    cpu_model = line.split(":", 1)[1].strip()
                    break
        except OSError:
            pass

        try:
            usage = shutil.disk_usage(str(Path.home()))
            disk = {
                "path": str(Path.home()),
                "total_bytes": usage.total,
                "free_bytes": usage.free,
            }
        except OSError:
            disk = {"path": str(Path.home()), "total_bytes": 0, "free_bytes": 0}

        return {
            "platform": f"{platform.system()} {platform.release()}",
            "cpu_model": cpu_model,
            "cpu_threads": os.cpu_count(),
            "memory_total_bytes": memory.get("MemTotal", 0),
            "memory_available_bytes": memory.get("MemAvailable", 0),
            "gpus": ModelHub._gpus(),
            "disk": disk,
        }

    @staticmethod
    def _gpus() -> list[dict[str, str]]:
        if not shutil.which("lspci"):
            return []
        try:
            result = subprocess.run(  # noqa: S603 - fixed command, no user input
                ["lspci"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):
            return []
        gpus: list[dict[str, str]] = []
        for line in result.stdout.splitlines():
            if not re.search(r"(VGA compatible|3D controller|Display controller)", line):
                continue
            name = line.split(": ", 1)[1] if ": " in line else line
            gpus.append({"name": name.strip()})
        return gpus
