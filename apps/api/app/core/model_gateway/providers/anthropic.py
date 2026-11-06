"""Anthropic Messages API with streaming."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from app.config import settings
from app.core.model_gateway.providers.base import BaseProvider, ProviderError, estimate_tokens
from app.core.model_gateway.schemas import (
    GenerationRequest,
    ModelSpec,
    StreamEvent,
    Usage,
)


class AnthropicProvider(BaseProvider):
    name = "anthropic"
    capabilities = ("smart", "reasoning", "coding", "vision")

    @property
    def configured(self) -> bool:
        return bool(settings.anthropic_api_key)

    async def stream(
        self, spec: ModelSpec, request: GenerationRequest
    ) -> AsyncIterator[StreamEvent]:
        if not settings.anthropic_api_key:
            raise ProviderError("anthropic is not configured")

        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": spec.model,
            "max_tokens": request.max_tokens or settings.model_max_tokens,
            "temperature": request.temperature
            if request.temperature is not None
            else settings.model_temperature,
            "messages": [
                {"role": m.role, "content": m.content}
                for m in request.messages
                if m.role in ("user", "assistant")
            ],
            "stream": True,
        }
        if request.system:
            payload["system"] = request.system

        usage = Usage()
        finish_reason = "stop"
        started = False

        async with self.client(self.timeout) as client:
            async with client.stream(
                "POST",
                f"{settings.anthropic_base_url.rstrip('/')}/v1/messages",
                headers=headers,
                json=payload,
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode(errors="ignore")[:400]
                    raise ProviderError(
                        f"anthropic returned {response.status_code}: {body}",
                        status=response.status_code,
                    )

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    try:
                        event = json.loads(line[5:].strip())
                    except json.JSONDecodeError:
                        continue

                    kind = event.get("type")
                    if kind == "message_start":
                        message_usage = (event.get("message") or {}).get("usage") or {}
                        usage.prompt_tokens = int(message_usage.get("input_tokens", 0))
                    elif kind == "content_block_delta":
                        delta = event.get("delta") or {}
                        text = delta.get("text")
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
                    elif kind == "message_delta":
                        delta = event.get("delta") or {}
                        if delta.get("stop_reason"):
                            finish_reason = delta["stop_reason"]
                        out = (event.get("usage") or {}).get("output_tokens")
                        if out is not None:
                            usage.completion_tokens = int(out)
                    elif kind == "error":
                        raise ProviderError(str(event.get("error")))

        if usage.total_tokens == 0:
            prompt = sum(estimate_tokens(m.content) for m in request.messages)
            usage.prompt_tokens = prompt
        usage.total_tokens = usage.prompt_tokens + usage.completion_tokens

        yield StreamEvent(
            type="done",
            provider=self.name,
            model=spec.model,
            role=spec.role,
            usage=usage,
            finish_reason=finish_reason,
        )
