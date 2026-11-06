"""Typed contracts for the Model Gateway."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Role = Literal["system", "user", "assistant", "tool"]


class Message(BaseModel):
    role: Role
    content: str


class GenerationRequest(BaseModel):
    capability: str = "fast"
    messages: list[Message] = Field(default_factory=list)
    system: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

    def merged(self, other: Usage) -> Usage:
        return Usage(
            prompt_tokens=self.prompt_tokens + other.prompt_tokens,
            completion_tokens=self.completion_tokens + other.completion_tokens,
            total_tokens=self.total_tokens + other.total_tokens,
        )


class ModelSpec(BaseModel):
    role: str
    provider: str
    model: str
    label: str
    context_window: int = 128_000
    input_cost: float = 0.0  # USD per 1M tokens
    output_cost: float = 0.0
    vision: bool = False
    reasoning: bool = False
    local: bool = False


class GenerationResult(BaseModel):
    text: str
    provider: str
    model: str
    role: str
    usage: Usage = Field(default_factory=Usage)
    cost_usd: float = 0.0
    finish_reason: str = "stop"
    fallback_used: bool = False


class StreamEvent(BaseModel):
    type: Literal["start", "delta", "done", "error"]
    text: str = ""
    provider: str | None = None
    model: str | None = None
    role: str | None = None
    usage: Usage | None = None
    cost_usd: float = 0.0
    finish_reason: str | None = None
    error: str | None = None
    fallback_used: bool = False
