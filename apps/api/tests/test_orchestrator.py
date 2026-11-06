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
