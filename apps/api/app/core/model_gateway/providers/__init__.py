"""Provider registry — the only place provider classes are wired up."""

from __future__ import annotations

from app.config import settings
from app.core.model_gateway.providers.anthropic import AnthropicProvider
from app.core.model_gateway.providers.base import BaseProvider, ProviderError
from app.core.model_gateway.providers.google import GoogleProvider
from app.core.model_gateway.providers.mock import MockProvider
from app.core.model_gateway.providers.ollama import OllamaProvider
from app.core.model_gateway.providers.openai import MistralProvider, OpenAICompatibleProvider

PROVIDER_FACTORIES: dict[str, type[BaseProvider]] = {
    "openai": OpenAICompatibleProvider,
    "anthropic": AnthropicProvider,
    "google": GoogleProvider,
    "mistral": MistralProvider,
    "ollama": OllamaProvider,
    "mock": MockProvider,
}


def create_providers() -> dict[str, BaseProvider]:
    return {
        name: factory(settings.model_request_timeout)
        for name, factory in PROVIDER_FACTORIES.items()
    }


__all__ = [
    "BaseProvider",
    "ProviderError",
    "PROVIDER_FACTORIES",
    "create_providers",
]
