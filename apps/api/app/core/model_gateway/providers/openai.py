"""OpenAI-compatible chat completions (OpenAI, Mistral, and compatible gateways)."""

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


class OpenAICompatibleProvider(BaseProvider):
    name = "openai"
    capabilities = ("fast", "smart", "reasoning", "coding", "vision")

    def __init__(self, timeout: float = 90.0) -> None:
        super().__init__(timeout)

    @property
    def api_key(self) -> str | None:
        return settings.openai_api_key

    @property
    def base_url(self) -> str:
        return settings.openai_base_url.rstrip("/")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _payload(self, spec: ModelSpec, request: GenerationRequest) -> dict:
        return {
            "model": spec.model,
            "messages": build_messages(request),
            "stream": True,
            "stream_options": {"include_usage": True},
            "temperature": request.temperature
            if request.temperature is not None
            else settings.model_temperature,
            "max_tokens": request.max_tokens or settings.model_max_tokens,
        }

    async def stream(
        self, spec: ModelSpec, request: GenerationRequest
    ) -> AsyncIterator[StreamEvent]:
        if not self.api_key:
            raise ProviderError(f"{self.name} is not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        usage = Usage()
        finish_reason = "stop"
        started = False

        async with self.client(self.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=self._payload(spec, request),
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode(errors="ignore")[:400]
                    raise ProviderError(
                        f"{self.name} returned {response.status_code}: {body}",
                        status=response.status_code,
                    )

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    if payload.get("usage"):
                        usage = Usage(
                            prompt_tokens=int(payload["usage"].get("prompt_tokens", 0)),
                            completion_tokens=int(payload["usage"].get("completion_tokens", 0)),
                            total_tokens=int(payload["usage"].get("total_tokens", 0)),
                        )

                    choices = payload.get("choices") or []
                    if not choices:
                        continue
                    choice = choices[0]
                    delta = (choice.get("delta") or {}).get("content")
                    if delta:
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
                        yield StreamEvent(type="delta", text=delta)
                    if choice.get("finish_reason"):
                        finish_reason = choice["finish_reason"]

        if usage.total_tokens == 0:
            text_len = 0  # provider did not report; gateway estimates from deltas
            prompt = sum(estimate_tokens(m.content) for m in request.messages)
            usage = Usage(prompt_tokens=prompt, completion_tokens=text_len)

        yield StreamEvent(
            type="done",
            provider=self.name,
            model=spec.model,
            role=spec.role,
            usage=usage,
            finish_reason=finish_reason,
        )


class MistralProvider(OpenAICompatibleProvider):
    name = "mistral"

    @property
    def api_key(self) -> str | None:
        return settings.mistral_api_key

    @property
    def base_url(self) -> str:
        return settings.mistral_base_url.rstrip("/")
