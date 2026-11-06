"""Model registry.

Roles (fast, reasoning, coding, vision, local, smart) map to a preferred provider
model plus an ordered fallback chain. This file loads `config/models.yaml` and
applies the `ORBITO_*_MODEL` environment overrides, so changing a model never
requires a code change.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from app.config import settings
from app.core.model_gateway.schemas import ModelSpec
from app.logging import get_logger

logger = get_logger(__name__)

MODELS_FILE = Path(__file__).resolve().parents[2] / "config" / "models.yaml"

ROLE_ENV_OVERRIDES = {
    "fast": ("orbito_fast_model",),
    "smart": ("orbito_smart_model",),
    "reasoning": ("orbito_reasoning_model",),
    "coding": ("orbito_coding_model",),
    "vision": ("orbito_vision_model",),
}


class ModelRegistry:
    def __init__(self, path: Path = MODELS_FILE) -> None:
        self.path = path
        self.roles: dict[str, ModelSpec] = {}
        self.fallbacks: dict[str, list[str]] = {}
        self.default_role: str = settings.orbito_default_model
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            logger.warning("model registry missing at %s, using mock only", self.path)
            self.roles = {
                "fast": ModelSpec(
                    role="fast", provider="mock", model="orbito-fast", label="ORBITO Fast (mock)"
                )
            }
            self.default_role = "fast"
            return

        raw: dict[str, Any] = yaml.safe_load(self.path.read_text()) or {}
        roles = raw.get("roles", {})
        for role, data in roles.items():
            provider = data.get("provider", "mock")
            model = data.get("model", f"orbito-{role}")
            override = self._env_override(role)
            if override:
                model = override
            self.roles[role] = ModelSpec(
                role=role,
                provider=provider,
                model=model,
                label=data.get("label", model),
                context_window=int(data.get("context_window", 128_000)),
                input_cost=float(data.get("input_cost", 0.0)),
                output_cost=float(data.get("output_cost", 0.0)),
                vision=bool(data.get("vision", False)),
                reasoning=bool(data.get("reasoning", False)),
                local=bool(data.get("local", False)),
            )

        self.fallbacks = {
            role: [str(item) for item in chain] for role, chain in raw.get("fallbacks", {}).items()
        }

        if self.default_role not in self.roles:
            self.default_role = next(iter(self.roles), "fast")

    def _env_override(self, role: str) -> str | None:
        for attr in ROLE_ENV_OVERRIDES.get(role, ()):
            value = getattr(settings, attr, None)
            if value:
                return str(value)
        return None

    def get(self, role: str) -> ModelSpec:
        if role in self.roles:
            return self.roles[role]
        return self.roles.get(self.default_role) or ModelSpec(
            role="fast", provider="mock", model="orbito-fast", label="ORBITO Fast (mock)"
        )

    def chain(self, role: str) -> list[ModelSpec]:
        """Preferred model first, then deduplicated fallbacks."""
        seen: set[tuple[str, str]] = set()
        chain: list[ModelSpec] = []
        for name in [role, *self.fallbacks.get(role, [])]:
            spec = self.get(name)
            key = (spec.provider, spec.model)
            if key not in seen:
                seen.add(key)
                chain.append(spec)
        return chain

    def all_specs(self) -> list[ModelSpec]:
        return list(self.roles.values())


registry = ModelRegistry()
