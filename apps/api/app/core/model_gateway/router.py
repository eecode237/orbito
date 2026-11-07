"""Model Gateway — the single door to every AI provider.

Callers ask for a *capability* (fast, reasoning, coding, vision, local), never a
vendor. The gateway resolves the registry chain, skips unconfigured providers,
fails over on provider errors, tracks usage, and estimates cost.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from app.config import settings
from app.core.model_gateway.pricing import estimate_cost
from app.core.model_gateway.providers import BaseProvider, ProviderError, create_providers
from app.core.model_gateway.providers.base import estimate_tokens
from app.core.model_gateway.registry import ModelRegistry, registry
from app.core.model_gateway.schemas import (
    GenerationRequest,
    GenerationResult,
    ModelSpec,
    StreamEvent,
    Usage,
)
from app.logging import get_logger

logger = get_logger(__name__)


class ModelGateway:
    def __init__(
        self,
        model_registry: ModelRegistry | None = None,
        providers: dict[str, BaseProvider] | None = None,
    ) -> None:
        self.registry = model_registry or registry
        self.providers = providers or create_providers()

    # -- introspection ------------------------------------------------------
    def resolve(self, capability: str) -> list[tuple[ModelSpec, BaseProvider]]:
        resolved: list[tuple[ModelSpec, BaseProvider]] = []
        for spec in self.registry.chain(capability):
            provider = self.providers.get(spec.provider)
            if provider and provider.configured:
                resolved.append((spec, provider))
        return resolved

    def describe(self) -> list[dict]:
        models: list[dict] = []
        for role, spec in self.registry.roles.items():
            provider = self.providers.get(spec.provider)
            entry = dict(spec)
            entry.update(
                {
                    "configured": bool(provider and provider.configured),
                    "is_default": role == self.registry.default_role,
                    "fallback_chain": [
                        {"role": item.role, "provider": item.provider, "model": item.model}
                        for item in self.registry.chain(role)
                    ],
                }
            )
            models.append(entry)
        return models

    def provider_status(self) -> list[dict]:
        labels = {
            "openai": "OpenAI",
            "anthropic": "Anthropic",
            "google": "Google Gemini",
            "mistral": "Mistral AI",
            "ollama": "Ollama (local)",
            "mock": "Offline model",
        }
        return [
            {
                "id": name,
                "label": labels.get(name, name.title()),
                "configured": provider.configured,
                "capabilities": list(provider.capabilities),
            }
            for name, provider in self.providers.items()
        ]

    # -- execution ----------------------------------------------------------
    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamEvent]:
        chain = self.resolve(request.capability)
        if not chain:
            yield StreamEvent(
                type="error",
                error=(
                    "No model is configured for this capability. Add a provider key in "
                    "Settings → AI Models."
                ),
            )
            return

        errors: list[str] = []
        for index, (spec, provider) in enumerate(chain):
            request.metadata["fallback_used"] = index > 0
            request.metadata["model_role"] = spec.role
            emitted = False
            completion_parts: list[str] = []
            usage = Usage()
            finish_reason = "stop"

            try:
                async for event in provider.stream(spec, request):
                    if event.type in ("start", "delta") and not emitted:
                        emitted = True
                        if index > 0:
                            yield StreamEvent(
                                type="start",
                                provider=spec.provider,
                                model=spec.model,
                                role=spec.role,
                                fallback_used=True,
                            )
                    if event.type == "delta":
                        completion_parts.append(event.text)
                        yield event
                        continue
                    if event.type == "done":
                        # Hold the provider's terminal event: the gateway owns the
                        # authoritative usage/cost numbers and emits a single done.
                        usage = event.usage or usage
                        finish_reason = event.finish_reason or "stop"
                        continue
                    if event.type == "error":
                        raise ProviderError(event.error or "provider error")
                    yield event

                # Fill in usage for providers that do not report token counts.
                if usage.total_tokens == 0:
                    completion = "".join(completion_parts)
                    prompt = sum(estimate_tokens(m.content) for m in request.messages)
                    completion_tokens = estimate_tokens(completion)
                    usage = Usage(
                        prompt_tokens=prompt,
                        completion_tokens=completion_tokens,
                        total_tokens=prompt + completion_tokens,
                    )
                cost = estimate_cost(spec, usage)
                yield StreamEvent(
                    type="done",
                    provider=spec.provider,
                    model=spec.model,
                    role=spec.role,
                    usage=usage,
                    cost_usd=cost,
                    finish_reason=finish_reason,
                    fallback_used=index > 0,
                )
                logger.info(
                    "model=%s provider=%s role=%s tokens=%s cost=$%.6f fallback=%s",
                    spec.model,
                    spec.provider,
                    spec.role,
                    usage.total_tokens,
                    cost,
                    index > 0,
                )
                return
            except ProviderError as exc:
                errors.append(f"{provider.name}: {exc}")
                logger.warning("provider %s failed: %s", provider.name, exc)
                if emitted:
                    yield StreamEvent(
                        type="error",
                        provider=spec.provider,
                        model=spec.model,
                        error=str(exc),
                    )
                    return
                continue
            except Exception as exc:  # pragma: no cover - defensive
                errors.append(f"{provider.name}: {exc}")
                logger.exception("unexpected provider failure (%s)", provider.name)
                if emitted:
                    yield StreamEvent(type="error", provider=spec.provider, error=str(exc))
                    return
                continue

        yield StreamEvent(
            type="error",
            error="All models failed: " + "; ".join(errors[-3:]),
        )

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        chunks: list[str] = []
        usage = Usage()
        cost = 0.0
        provider = "unknown"
        model = "unknown"
        role = request.capability
        finish_reason = "stop"
        fallback = False

        async for event in self.stream(request):
            if event.type == "delta":
                chunks.append(event.text)
            elif event.type == "done":
                usage = event.usage or usage
                cost = event.cost_usd
                provider = event.provider or provider
                model = event.model or model
                role = event.role or role
                finish_reason = event.finish_reason or finish_reason
                fallback = event.fallback_used
            elif event.type == "error":
                raise ProviderError(event.error or "generation failed")

        return GenerationResult(
            text="".join(chunks),
            provider=provider,
            model=model,
            role=role,
            usage=usage,
            cost_usd=cost,
            finish_reason=finish_reason,
            fallback_used=fallback,
        )


gateway = ModelGateway()
