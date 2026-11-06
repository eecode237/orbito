"""Tool contract and permission levels."""

from __future__ import annotations

from abc import ABC, abstractmethod
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ToolPermission(StrEnum):
    AUTO = "auto"  # safe read-only action
    APPROVAL = "approval"  # needs an explicit human approval
    RESTRICTED = "restricted"  # sandbox only, never host execution


class ToolResult(BaseModel):
    ok: bool = True
    summary: str = ""
    data: Any = None
    sources: list[dict[str, str]] = Field(default_factory=list)
    error: str | None = None


class Tool(ABC):
    name: str = "tool"
    description: str = ""
    permission: ToolPermission = ToolPermission.AUTO
    timeout: float = 30.0

    @abstractmethod
    async def run(self, **kwargs: Any) -> ToolResult:
        raise NotImplementedError

    def schema_hint(self) -> dict[str, Any]:
        return {"name": self.name, "description": self.description, "permission": self.permission}
