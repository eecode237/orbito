"""Live host telemetry, process inspection and alerts.

``/system/overview`` is the single read used by the System Center.  The smaller
endpoints return slices of the same cached snapshot so a sub-page can refresh
without paying for another hardware sample.  ``/system/stats`` remains for the
existing dashboard widgets and is backed by the legacy monitor.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.system_center import alerts as alert_service
from app.core.system_center import collector, processes
from app.core.system_monitor import monitor

router = APIRouter(prefix="/system", tags=["system"])


class AlertDecision(BaseModel):
    acknowledged: bool = True


@router.get("/overview")
async def overview() -> dict[str, Any]:
    """One cached snapshot: CPU, memory, disks, GPU, thermal, battery, IO."""
    return await collector.snapshot()


@router.get("/cpu")
async def cpu() -> dict[str, Any]:
    snapshot = await collector.snapshot()
    return {
        "timestamp": snapshot["timestamp"],
        "cpu": snapshot["cpu"],
    }


@router.get("/memory")
async def memory() -> dict[str, Any]:
    snapshot = await collector.snapshot()
    return {
        "timestamp": snapshot["timestamp"],
        "memory": snapshot["memory"],
    }


@router.get("/disk")
async def disk() -> dict[str, Any]:
    snapshot = await collector.snapshot()
    return {
        "timestamp": snapshot["timestamp"],
        "disk": snapshot["disk"],
        "io": snapshot["disk_io"],
    }


@router.get("/gpu")
async def gpu() -> dict[str, Any]:
    snapshot = await collector.snapshot()
    return {
        "timestamp": snapshot["timestamp"],
        "gpu": snapshot["gpu"],
    }


@router.get("/thermal")
async def thermal() -> dict[str, Any]:
    snapshot = await collector.snapshot()
    return {
        "timestamp": snapshot["timestamp"],
        "thermal": snapshot["thermal"],
    }


@router.get("/battery")
async def battery() -> dict[str, Any]:
    snapshot = await collector.snapshot()
    return {
        "timestamp": snapshot["timestamp"],
        "battery": snapshot.get("battery"),
    }


@router.get("/history")
async def history(
    range_id: str = Query(default="15m", alias="range", pattern="^(1m|5m|15m|30m|1h|6h|24h)$"),
    points: int = Query(default=240, ge=20, le=600),
) -> dict[str, Any]:
    return await collector.history(range_id, max_points=points)


@router.get("/processes")
async def process_list(
    q: str | None = Query(default=None, max_length=120),
    user: str | None = Query(default=None, max_length=80),
    sort: str = Query(default="cpu", pattern="^(cpu|memory|memory_percent|name|pid|runtime)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    min_cpu: float | None = Query(default=None, ge=0, le=100),
    min_memory: float | None = Query(default=None, ge=0, le=100),
) -> dict[str, Any]:
    return processes.list_processes(
        query=q,
        user=user,
        sort=sort,
        limit=limit,
        offset=offset,
        min_cpu=min_cpu,
        min_memory=min_memory,
    )


@router.get("/processes/{pid}")
async def process_detail(pid: int) -> dict[str, Any]:
    try:
        return processes.process_detail(pid)
    except processes.ProcessNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except processes.ProcessPermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/processes/{pid}/terminate")
async def process_terminate(
    pid: int,
    force: bool = Query(default=False, description="Send SIGKILL if SIGTERM is ignored"),
) -> dict[str, Any]:
    try:
        return processes.terminate_process(pid, force=force)
    except processes.ProcessNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except processes.ProcessPermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except processes.ProcessStillRunning as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/alerts")
async def alerts() -> dict[str, Any]:
    """Threshold alerts with acknowledgement state."""
    return await alert_service.list_alerts()


@router.patch("/alerts/{alert_id}")
async def acknowledge_alert(alert_id: str, decision: AlertDecision) -> dict[str, Any]:
    return alert_service.acknowledge(alert_id, decision.acknowledged)


# --- compatibility with the first dashboard widgets -------------------------


@router.get("/stats")
async def stats() -> dict[str, Any]:
    """Legacy compact payload used by the old dashboard widgets."""
    return await monitor.stats()
