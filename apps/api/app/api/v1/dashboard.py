"""Command Center aggregation.

The Overview page needs a wide but shallow slice of the system: health,
telemetry, task counters, recent executions, model availability and usage.
This router composes the existing services in one round trip so the dashboard
does not fan out ten requests, and it never invents a value when a subsystem is
unavailable — it returns ``reachable``/error fields instead.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from sqlalchemy import text

from app.agents.registry import agents
from app.api.v1.tasks import event_payload, task_payload
from app.config import settings
from app.core.model_gateway import gateway
from app.core.model_gateway.hub import ModelHub, ModelHubError
from app.core.system_monitor import monitor
from app.db import repositories as repo
from app.db.session import engine

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

hub = ModelHub()


async def _database_status() -> str:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "unavailable"


async def _model_summary() -> dict[str, Any]:
    if not settings.ollama_enabled:
        return {
            "enabled": False,
            "ollama": {
                "reachable": False,
                "version": None,
                "base_url": settings.ollama_base_url,
                "error": "Local models are disabled.",
            },
            "installed": [],
            "running": [],
            "reachable": False,
            "error": "Local models are disabled.",
        }
    status = await hub.status()
    summary: dict[str, Any] = {
        "enabled": settings.ollama_enabled,
        "ollama": status,
        "installed": [],
        "running": [],
        "reachable": bool(status.get("reachable")),
        "error": status.get("error"),
    }
    if not status.get("reachable"):
        return summary
    try:
        installed, running = await asyncio.gather(hub.installed(), hub.running())
    except ModelHubError as exc:
        summary["reachable"] = False
        summary["error"] = str(exc)
        return summary
    summary["installed"] = installed
    summary["running"] = running
    return summary


@router.get("/overview")
async def overview() -> dict[str, Any]:
    """One aggregated snapshot for the command center."""
    (
        database,
        stats,
        metrics,
        recent_tasks,
        active_tasks,
        paused_tasks,
        usage,
        series,
        breakdown,
        events,
        models,
    ) = await asyncio.gather(
        _database_status(),
        monitor.stats(),
        repo.task_stats(),
        repo.list_tasks(limit=100),
        repo.list_tasks(status="running", limit=50),
        repo.list_tasks(status="paused", limit=50),
        repo.usage_summary(),
        repo.usage_timeseries(days=14),
        repo.usage_breakdown(),
        repo.list_recent_events(limit=16),
        _model_summary(),
    )

    models["catalog"] = gateway.describe()
    providers = gateway.provider_status()
    pending = [
        {
            "task_id": task.id,
            "title": task.title,
            "agent": task.agent,
            "request": (task.meta or {}).get("approval_request"),
            "created_at": task.created_at.isoformat() if task.created_at else None,
        }
        for task in recent_tasks
        if (task.meta or {}).get("approval_request")
    ]

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "health": {
            "database": database,
            "providers": {model["id"]: model["configured"] for model in providers},
            "provider_labels": {model["id"]: model["label"] for model in providers},
            "live_provider": any(
                model["configured"] and model["id"] != "mock" for model in providers
            ),
        },
        "system": stats,
        "tasks": {
            "metrics": metrics,
            "recent": [task_payload(task) for task in recent_tasks[:8]],
            "active": [task_payload(task) for task in [*active_tasks, *paused_tasks]],
            "pending_approvals": pending,
        },
        "usage": {
            "summary": usage,
            "series": series,
            "breakdown": breakdown,
        },
        "activity": [event_payload(event) for event in events],
        "models": models,
        "agents": agents.describe(),
    }
