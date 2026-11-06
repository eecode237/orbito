"""Google Gemini streaming (generateContent SSE)."""

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


class GoogleProvider(BaseProvider):
    name = "google"
    capabilities = ("fast", "smart", "vision", "reasoning")

    @property
    def configured(self) -> bool:
        return bool(settings.google_api_key)

    async def stream(
        self, spec: ModelSpec, request: GenerationRequest
    ) -> AsyncIterator[StreamEvent]:
        if not settings.google_api_key:
            raise ProviderError("google is not configured")

        contents = [
            {
                "role": "model" if m.role == "assistant" else "user",
                "parts": [{"text": m.content}],
            }
            for m in request.messages
            if m.role in ("user", "assistant")
        ]
        payload: dict = {
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature
                if request.temperature is not None
                else settings.model_temperature,
                "maxOutputTokens": request.max_tokens or settings.model_max_tokens,
            },
        }
        if request.system:
            payload["systemInstruction"] = {"parts": [{"text": request.system}]}

        url = (
            f"{settings.google_base_url.rstrip('/')}/v1beta/models/"
            f"{spec.model}:streamGenerateContent?alt=sse&key={settings.google_api_key}"
        )

        usage = Usage()
        finish_reason = "stop"
        started = False

        async with self.client(self.timeout) as client:
            async with client.stream(
                "POST", url, headers={"Content-Type": "application/json"}, json=payload
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode(errors="ignore")[:400]
                    raise ProviderError(
                        f"google returned {response.status_code}: {body}",
                        status=response.status_code,
                    )

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    try:
                        event = json.loads(line[5:].strip())
                    except json.JSONDecodeError:
                        continue

                    metadata = event.get("usageMetadata") or {}
                    if metadata:
                        usage = Usage(
                            prompt_tokens=int(metadata.get("promptTokenCount", 0)),
                            completion_tokens=int(metadata.get("candidatesTokenCount", 0)),
                            total_tokens=int(metadata.get("totalTokenCount", 0)),
                        )

                    for candidate in event.get("candidates") or []:
                        for part in (candidate.get("content") or {}).get("parts", []):
                            text = part.get("text")
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
                        if candidate.get("finishReason"):
                            finish_reason = str(candidate["finishReason"]).lower()

        if usage.total_tokens == 0:
            usage.prompt_tokens = sum(estimate_tokens(m.content) for m in request.messages)
            usage.total_tokens = usage.prompt_tokens

        yield StreamEvent(
            type="done",
            provider=self.name,
            model=spec.model,
            role=spec.role,
            usage=usage,
            finish_reason=finish_reason,
        )
