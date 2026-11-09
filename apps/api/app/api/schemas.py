"""HTTP contracts for the public API (v1)."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=32_000)
    conversation_id: str | None = None
    agent: str | None = "auto"
    model_role: str | None = None
    workspace_id: str | None = None
    project_task_id: str | None = None
    # Optional attached file context from the workspace explorer.
    context: str | None = Field(default=None, max_length=60_000)
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


WorkItemStatus = Literal["backlog", "todo", "in_progress", "blocked", "done"]
WorkItemPriority = Literal["low", "normal", "high", "urgent"]


class ProjectWorkItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=12_000)
    status: WorkItemStatus = "backlog"
    priority: WorkItemPriority = "normal"
    scheduled_for: date | None = None
    due_date: date | None = None
    estimate_minutes: int | None = Field(default=None, ge=0, le=100_000)
    labels: list[str] = Field(default_factory=list, max_length=12)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Title cannot be blank.")
        return title

    @field_validator("labels")
    @classmethod
    def _clean_labels(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(label.strip()[:40] for label in value if label.strip()))[:12]


class ProjectWorkItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=12_000)
    status: WorkItemStatus | None = None
    priority: WorkItemPriority | None = None
    scheduled_for: date | None = None
    due_date: date | None = None
    estimate_minutes: int | None = Field(default=None, ge=0, le=100_000)
    labels: list[str] | None = Field(default=None, max_length=12)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        title = value.strip()
        if not title:
            raise ValueError("Title cannot be blank.")
        return title

    @field_validator("labels")
    @classmethod
    def _clean_labels(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return list(dict.fromkeys(label.strip()[:40] for label in value if label.strip()))[:12]


WorkflowStatus = Literal["draft", "active", "paused", "archived"]
WorkflowTriggerType = Literal["manual", "schedule", "webhook", "event", "chat"]
WorkflowRunStatus = Literal["queued", "running", "completed", "failed", "cancelled", "pending_runner"]


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=8000)
    trigger: dict[str, Any] = Field(default_factory=lambda: {"type": "manual", "config": {}})
    definition: dict[str, Any] = Field(default_factory=lambda: {"nodes": [], "edges": [], "version": 1})
    enabled: bool = True
    status: WorkflowStatus = "draft"

    @field_validator("name")
    @classmethod
    def _workflow_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Workflow name cannot be blank.")
        return name

    @field_validator("trigger")
    @classmethod
    def _workflow_trigger(cls, value: dict[str, Any]) -> dict[str, Any]:
        trigger = dict(value or {})
        trigger.setdefault("type", "manual")
        trigger.setdefault("config", {})
        if not isinstance(trigger.get("config"), dict):
            trigger["config"] = {}
        return trigger

    @field_validator("definition")
    @classmethod
    def _workflow_definition(cls, value: dict[str, Any]) -> dict[str, Any]:
        definition = dict(value or {})
        nodes = definition.get("nodes")
        edges = definition.get("edges")
        definition["nodes"] = nodes if isinstance(nodes, list) else []
        definition["edges"] = edges if isinstance(edges, list) else []
        definition.setdefault("version", 1)
        return definition


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=8000)
    trigger: dict[str, Any] | None = None
    definition: dict[str, Any] | None = None
    enabled: bool | None = None
    status: WorkflowStatus | None = None

    @field_validator("name")
    @classmethod
    def _workflow_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = value.strip()
        if not name:
            raise ValueError("Workflow name cannot be blank.")
        return name


class WorkflowRunCreate(BaseModel):
    triggered_by: str = Field(default="manual", max_length=40)
    input: dict[str, Any] = Field(default_factory=dict)
