"""Ollama local models (NDJSON streaming)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from app.config import settings
from app.core.model_gateway.providers.base import (
    BaseProvider,
    ProviderError,
    build_messages,
    estimate_tokens,
)
from app.core.model_gateway.schemas import (
    GenerationRequest,
    ModelSpec,
    StreamEvent,
    Usage,
)


class OllamaProvider(BaseProvider):
    name = "ollama"
    capabilities = ("fast", "local", "coding")

    @property
    def configured(self) -> bool:
        # Local server; start it and the gateway can use it. Failure falls back.
        return bool(settings.ollama_base_url)

    async def stream(
        self, spec: ModelSpec, request: GenerationRequest
    ) -> AsyncIterator[StreamEvent]:
        payload = {
            "model": spec.model,
            "messages": build_messages(request),
            "stream": True,
            "options": {
                "temperature": request.temperature
                if request.temperature is not None
                else settings.model_temperature,
                "num_predict": request.max_tokens or settings.model_max_tokens,
            },
        }
        usage = Usage()
        started = False

        try:
            async with self.client(self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_base_url.rstrip('/')}/api/chat",
                    json=payload,
                ) as response:
                    if response.status_code >= 400:
                        body = (await response.aread()).decode(errors="ignore")[:300]
                        raise ProviderError(
                            f"ollama returned {response.status_code}: {body}",
                            status=response.status_code,
                        )

                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        text = (event.get("message") or {}).get("content")
                        if text:
                            if not started:
                                started = True
                                yield StreamEvent(
                                    type="start",
                                    provider=self.name,
                                    model=spec.model,
                                    role=spec.role,
                                    fallback_used=bool(
                                        request.metadata.get("fallback_used")
                                    ),
                                )
                            yield StreamEvent(type="delta", text=text)
                        if event.get("done"):
                            usage = Usage(
                                prompt_tokens=int(event.get("prompt_eval_count", 0)),
                                completion_tokens=int(event.get("eval_count", 0)),
                                total_tokens=int(event.get("prompt_eval_count", 0))
                                + int(event.get("eval_count", 0)),
                            )
        except ProviderError:
            raise
        except Exception as exc:
            raise ProviderError(f"ollama unreachable: {exc}") from exc

        if usage.total_tokens == 0:
            usage.prompt_tokens = sum(estimate_tokens(m.content) for m in request.messages)
            usage.total_tokens = usage.prompt_tokens

        yield StreamEvent(
            type="done",
            provider=self.name,
            model=spec.model,
            role=spec.role,
            usage=usage,
            finish_reason="stop",
        )
