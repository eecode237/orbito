"""Live host telemetry used by the dashboard and the system page."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.system_monitor import monitor

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/stats")
async def stats() -> dict[str, Any]:
    """CPU, memory, swap, disk, temperature, battery and Ollama status."""
    return await monitor.stats()


@router.get("/alerts")
async def alerts() -> dict[str, Any]:
    """Alert list derived from the current snapshot."""
    return await monitor.alerts()
