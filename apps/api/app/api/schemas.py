"""HTTP contracts for the public API (v1)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=32_000)
    conversation_id: str | None = None
    agent: str | None = "auto"
    model_role: str | None = None
    workspace_id: str | None = None
    stream: bool = True

    @field_validator("message")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message cannot be blank.")
        return value.strip()


class ChatResponse(BaseModel):
    task_id: str | None = None
    conversation_id: str | None = None
    message: str = ""
    agent: dict[str, Any] | None = None
    model: dict[str, Any] | None = None
    usage: dict[str, Any] | None = None
    cost_usd: float = 0.0


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    scope: Literal["long_term", "workspace"] = "long_term"
    key: str | None = None
    workspace_id: str | None = None


class ScrapingJobCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    urls: list[str] = Field(min_length=1, max_length=50)
    scrape_schema: dict[str, Any] = Field(default_factory=dict, alias="schema")
    config: dict[str, Any] = Field(default_factory=dict)

    @field_validator("urls")
    @classmethod
    def _urls(cls, value: list[str]) -> list[str]:
        cleaned = [url.strip() for url in value if url.strip()]
        if not cleaned:
            raise ValueError("At least one URL is required.")
        return cleaned


class ApprovalRequest(BaseModel):
    step_index: int | None = None
    approved: bool = True
    note: str | None = None


class PullRequest(BaseModel):
    """Request a model download from the local Ollama registry."""

    name: str = Field(min_length=1, max_length=128)
