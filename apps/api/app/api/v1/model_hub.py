"""Local model hub — discovery, downloads and hardware diagnostics.

The dashboard reads `GET /model-hub/overview`; downloads use SSE so a 4 GB
pull reports progress instead of blocking a request for ten minutes.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

from app.api.schemas import PullRequest
from app.api.sse import SSE_HEADERS, sse
from app.config import settings
from app.core.model_gateway.hub import (
    SUGGESTIONS,
    ModelHub,
    ModelHubError,
    is_valid_model_name,
)

router = APIRouter(prefix="/model-hub", tags=["model-hub"])

hub = ModelHub()


def _suggestions(installed: set[str]) -> list[dict[str, Any]]:
    return [{**item, "installed": item["name"] in installed} for item in SUGGESTIONS]


def _offline(status: dict[str, Any], hardware: dict[str, Any]) -> dict[str, Any]:
    return {
        "ollama": status,
        "installed": [],
        "running": [],
        "hardware": hardware,
        "suggestions": _suggestions(set()),
        "enabled": settings.ollama_enabled,
    }


@router.get("/overview")
async def overview() -> dict[str, Any]:
    """One round trip for the Model Hub screen."""
    status = await hub.status()
    hardware = await hub.hardware()
    if not status["reachable"]:
        return _offline(status, hardware)

    try:
        installed = await hub.installed()
        running = await hub.running()
    except ModelHubError as exc:
        return _offline({**status, "reachable": False, "error": str(exc)}, hardware)

    names = {row["name"] for row in installed if row.get("name")}
    return {
        "ollama": status,
        "installed": installed,
        "running": running,
        "hardware": hardware,
        "suggestions": _suggestions(names),
        "enabled": settings.ollama_enabled,
    }


@router.get("/hardware")
async def hardware() -> dict[str, Any]:
    return await hub.hardware()


@router.get("/models/show")
async def show(name: str = Query(min_length=1, max_length=128)) -> dict[str, Any]:
    try:
        return await hub.show(name)
    except ModelHubError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/pull")
async def pull(payload: PullRequest, request: Request) -> StreamingResponse:
    name = payload.name.strip()
    if not is_valid_model_name(name):
        raise HTTPException(status_code=422, detail="Invalid model name.")

    status = await hub.status()
    if not status["reachable"]:
        raise HTTPException(
            status_code=503,
            detail=status["error"] or "Ollama is not reachable.",
        )

    async def events():
        try:
            async for event in hub.pull(name):
                if await request.is_disconnected():
                    return
                yield sse({"type": "progress", "model": name, **event})
            yield sse({"type": "done", "model": name})
        except ModelHubError as exc:
            yield sse({"type": "error", "model": name, "error": str(exc)})

    return StreamingResponse(
        events(), media_type="text/event-stream", headers=SSE_HEADERS
    )


@router.delete("/models", status_code=204)
async def remove(name: str = Query(min_length=1, max_length=128)) -> Response:
    if not is_valid_model_name(name):
        raise HTTPException(status_code=422, detail="Invalid model name.")
    try:
        removed = await hub.remove(name)
    except ModelHubError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not removed:
        raise HTTPException(status_code=404, detail=f"{name} is not installed.")
    return Response(status_code=204)
