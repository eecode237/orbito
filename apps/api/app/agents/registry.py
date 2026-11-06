"""Agent registry and intent routing."""

from __future__ import annotations

from app.agents.base import Agent
from app.agents.specialists import ALL_AGENTS, core
from app.logging import get_logger

logger = get_logger(__name__)


class AgentRegistry:
    def __init__(self) -> None:
        self._agents = ALL_AGENTS

    def get(self, slug: str | None) -> Agent:
        if not slug or slug == "auto":
            return core
        return self._agents.get(slug, core)

    def all(self) -> list[Agent]:
        return list(self._agents.values())

    def select(self, message: str, requested: str | None = None) -> Agent:
        """Explicit selection wins; otherwise score keyword intent."""
        if requested and requested not in {"auto", "core"}:
            agent = self._agents.get(requested)
            if agent:
                return agent

        best: Agent | None = None
        best_score = 0
        for agent in self._agents.values():
            if agent.slug == "core":
                continue
            score = agent.score(message)
            if score > best_score:
                best = agent
                best_score = score

        if best and best_score >= 1:
            logger.info("router selected agent=%s score=%s", best.slug, best_score)
            return best
        return core

    def describe(self) -> list[dict]:
        return [agent.describe() for agent in self._agents.values()]


agents = AgentRegistry()

__all__ = ["Agent", "AgentRegistry", "agents"]
