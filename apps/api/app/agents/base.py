"""Agent contract.

An agent declares its identity, the tools it may use, and what needs approval.
It does not call providers directly — the orchestrator owns execution.
"""

from __future__ import annotations

from abc import ABC
from dataclasses import dataclass, field
from typing import Any

from app.tools.base import ToolResult


@dataclass(slots=True)
class AgentPlanStep:
    title: str
    tool: str | None = None
    detail: str | None = None


@dataclass(slots=True)
class Agent:
    slug: str
    name: str
    tagline: str
    description: str
    accent: str
    capabilities: list[str]
    tools: list[str]
    system_prompt: str
    samples: list[str] = field(default_factory=list)
    approval_required: list[str] = field(default_factory=list)
    model_role: str = "smart"
    keywords: list[str] = field(default_factory=list)

    def score(self, message: str) -> int:
        lowered = message.lower()
        return sum(2 if " " in keyword else 1 for keyword in self.keywords if keyword in lowered)

    def plan(self, message: str) -> list[AgentPlanStep]:
        raise NotImplementedError

    async def gather(self, message: str, context: dict[str, Any]) -> ToolResult | None:
        """Optional pre-reasoning tool work (search, file read, ...)."""
        return None

    def describe(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "name": self.name,
            "tagline": self.tagline,
            "description": self.description,
            "accent": self.accent,
            "capabilities": self.capabilities,
            "tools": self.tools,
            "samples": self.samples,
            "approval_required": self.approval_required,
            "model_role": self.model_role,
        }
