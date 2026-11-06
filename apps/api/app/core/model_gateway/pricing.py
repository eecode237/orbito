"""Cost estimation for model usage.

Rates are USD per 1M tokens. Model specs in `config/models.yaml` can override
these defaults; unknown models fall back to zero-cost so a missing rate never
breaks a request.
"""

from __future__ import annotations

from app.core.model_gateway.schemas import ModelSpec, Usage

# Best-effort public list prices, kept in one place for easy updates.
KNOWN_RATES: dict[str, tuple[float, float]] = {
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-2.5-pro": (1.25, 10.00),
    "mistral-large-latest": (2.00, 6.00),
}


def estimate_cost(spec: ModelSpec, usage: Usage) -> float:
    input_rate, output_rate = KNOWN_RATES.get(spec.model, (spec.input_cost, spec.output_cost))
    cost = (usage.prompt_tokens / 1_000_000) * input_rate
    cost += (usage.completion_tokens / 1_000_000) * output_rate
    return round(cost, 8)
