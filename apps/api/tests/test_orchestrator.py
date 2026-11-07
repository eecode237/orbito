"""Orchestrator behaviour: routing, plan, stream, completion."""

from __future__ import annotations

import pytest

from app.core.orchestrator import OrchestratorRequest, orchestrator
from app.db.repositories import DEMO_USER_ID


@pytest.mark.asyncio
async def test_routes_and_streams_a_plan():
    events = [
        event
        async for event in orchestrator.run(
            OrchestratorRequest(
                message="Explain gradient descent to me",
                user_id=DEMO_USER_ID,
                agent_slug="study",
                model_role="fast",
            )
        )
    ]

    types = [event["type"] for event in events]
    assert "task.created" in types
    assert "step.updated" in types
    assert "delta" in types
    assert types[-1] == "done"

    created = next(event for event in events if event["type"] == "task.created")
    assert created["agent"]["slug"] == "study"
    assert len(created["steps"]) >= 3

    done = events[-1]
    assert done["message"].strip()
    assert done["usage"]["total_tokens"] > 0


@pytest.mark.asyncio
async def test_router_selects_research_agent_for_scraping():
    events = [
        event
        async for event in orchestrator.run(
            OrchestratorRequest(
                message="Scrape these competitor websites and summarize pricing",
                user_id=DEMO_USER_ID,
                agent_slug="auto",
                model_role="fast",
            )
        )
    ]
    created = next(event for event in events if event["type"] == "task.created")
    assert created["agent"]["slug"] == "research"


@pytest.mark.asyncio
async def test_tool_sources_are_streamed_as_dicts(monkeypatch):
    """Regression: ToolResult.sources are plain dicts — the runner must not
    call .model_dump() on them (crashed specialist agents with sources)."""
    from app.agents.registry import agents
    from app.tools.base import ToolResult

    agent = agents.get("career")

    async def fake_gather(message: str, context: dict) -> ToolResult:
        return ToolResult(
            ok=True,
            summary="Found 1 matching job",
            sources=[
                {
                    "title": "ML Engineer",
                    "url": "https://example.com/job/1",
                    "snippet": "remote",
                }
            ],
        )

    monkeypatch.setattr(agent, "gather", fake_gather)

    events = [
        event
        async for event in orchestrator.run(
            OrchestratorRequest(
                message="Find machine learning jobs in Canada",
                user_id=DEMO_USER_ID,
                agent_slug="career",
                model_role="fast",
            )
        )
    ]

    types = [event["type"] for event in events]
    assert "sources" in types
    assert types[-1] == "done"
    src = next(event for event in events if event["type"] == "sources")
    assert src["sources"][0]["url"] == "https://example.com/job/1"
    done = events[-1]
    assert done["agent"]["slug"] == "career"
