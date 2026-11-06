"""Provider contract shared by every model integration."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

import httpx

from app.core.model_gateway.schemas import (
    GenerationRequest,
    GenerationResult,
    ModelSpec,
    StreamEvent,
    Usage,
)


class ProviderError(RuntimeError):
    """Any provider-level failure that should trigger the fallback chain."""

    def __init__(self, message: str, *, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


def estimate_tokens(text: str) -> int:
    """Cheap approximation when a provider does not report usage."""
    return max(1, len(text) // 4) if text else 0


def build_messages(request: GenerationRequest) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    if request.system:
        messages.append({"role": "system", "content": request.system})
    messages.extend({"role": m.role, "content": m.content} for m in request.messages)
    return messages


class BaseProvider(ABC):
    name: str = "base"
    capabilities: tuple[str, ...] = ("fast",)

    def __init__(self, timeout: float = 90.0) -> None:
        self.timeout = timeout

    @property
    def configured(self) -> bool:
        """Whether credentials/endpoint exist. Mock and Ollama are always 'on'."""
        return True

    def supports(self, spec: ModelSpec) -> bool:
        return spec.provider == self.name

    @abstractmethod
    def stream(
        self, spec: ModelSpec, request: GenerationRequest
    ) -> AsyncIterator[StreamEvent]:
        raise NotImplementedError

    async def complete(
        self, spec: ModelSpec, request: GenerationRequest
    ) -> GenerationResult:
        chunks: list[str] = []
        usage = Usage()
        finish_reason = "stop"
        async for event in self.stream(spec, request):
            if event.type == "delta":
                chunks.append(event.text)
            elif event.type == "done":
                usage = event.usage or usage
                finish_reason = event.finish_reason or finish_reason
        text = "".join(chunks)
        if usage.total_tokens == 0:
            prompt = sum(estimate_tokens(m.content) for m in request.messages)
            usage = Usage(
                prompt_tokens=prompt,
                completion_tokens=estimate_tokens(text),
                total_tokens=prompt + estimate_tokens(text),
            )
        return GenerationResult(
            text=text,
            provider=spec.provider,
            model=spec.model,
            role=spec.role,
            usage=usage,
            finish_reason=finish_reason,
        )

    @staticmethod
    def client(timeout: float) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=timeout, follow_redirects=True)
