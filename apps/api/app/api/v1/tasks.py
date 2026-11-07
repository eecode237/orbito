"""Task inspection, execution events and control.

The Agent Monitor reads real task rows and execution events from this router.
Nothing here invents activity: if a task did not run, it has no events.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.sse import SSE_HEADERS, sse
from app.core import task_controls as controls
from app.core.orchestrator import OrchestratorRequest, orchestrator
from app.db import repositories as repo

router = APIRouter(prefix="/tasks", tags=["tasks"])

TERMINAL = {"completed", "failed", "cancelled"}


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _duration(task) -> float | None:
    if not task.started_at or not task.finished_at:
        return None
    try:
        return round(max(0.0, (task.finished_at - task.started_at).total_seconds()), 1)
    except TypeError:
        return None


def _step_payload(step) -> dict[str, Any]:
    duration = None
    if step.started_at and step.finished_at:
        try:
            duration = round(
                max(0.0, (step.finished_at - step.started_at).total_seconds()), 1
            )
        except TypeError:
            duration = None
    return {
        "index": step.index,
        "title": step.title,
        "status": step.status,
        "detail": step.detail,
        "tool": step.tool,
        "started_at": _iso(step.started_at),
        "finished_at": _iso(step.finished_at),
        "duration_seconds": duration,
    }


def task_payload(task) -> dict[str, Any]:
    meta = task.meta or {}
    return {
        "id": task.id,
        "title": task.title,
        "prompt": task.prompt,
        "agent": task.agent,
        "status": task.status,
        "progress": task.progress,
        "result": task.result,
        "error": task.error,
        "model": task.model,
        "provider": task.provider,
        "cost_usd": task.cost_usd,
        "conversation_id": task.conversation_id,
        "created_at": _iso(task.created_at),
        "started_at": _iso(task.started_at),
        "finished_at": _iso(task.finished_at),
        "duration_seconds": _duration(task),
        "meta": meta,
        "sources": meta.get("sources") or [],
        "approval_request": meta.get("approval_request"),
        "steps": [_step_payload(step) for step in sorted(task.steps, key=lambda item: item.index)],
    }


def event_payload(event) -> dict[str, Any]:
    return {
        "id": event.id,
        "task_id": event.task_id,
        "kind": event.kind,
        "level": event.level,
        "message": event.message,
        "detail": event.detail,
        "step_index": event.step_index,
        "data": event.data or {},
        "created_at": _iso(event.created_at),
    }


@router.get("")
async def list_tasks(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: str | None = None,
    q: str | None = Query(default=None, max_length=200),
) -> dict:
    tasks = await repo.list_tasks(limit=limit, offset=offset, status=status, query=q)
    total = await repo.count_tasks(status=status, query=q)
    return {
        "tasks": [task_payload(task) for task in tasks],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/metrics")
async def task_metrics() -> dict:
    """Real counters for the Agent Monitor header."""
    return await repo.task_stats()


@router.get("/{task_id}")
async def get_task(task_id: str) -> dict:
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    payload = task_payload(task)
    payload["usage"] = await repo.task_usage(task_id)
    return payload


@router.get("/{task_id}/events")
async def get_task_events(task_id: str, limit: int = Query(default=500, ge=1, le=1000)) -> dict:
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    events = await repo.list_task_events(task_id, limit=limit)
    return {"task_id": task_id, "events": [event_payload(event) for event in events]}


@router.get("/{task_id}/events/stream")
async def stream_task_events(task_id: str) -> StreamingResponse:
    """SSE stream of execution events.

    Existing events are replayed first, then new rows are polled until the task
    reaches a terminal state. Polling the database keeps this correct even if
    the run is handled by another process later.
    """
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_stream() -> AsyncIterator[str]:
        seen: set[str] = set()
        idle = 0
        while True:
            current = await repo.get_task(task_id)
            events = await repo.list_task_events(task_id, limit=1000)
            for event in events:
                if event.id in seen:
                    continue
                seen.add(event.id)
                yield sse({"type": "event", "event": event_payload(event)})
            terminal = bool(current and current.status in TERMINAL)
            if terminal:
                idle += 1
            if terminal and idle >= 2:
                yield sse({"type": "closed", "task_id": task_id})
                return
            if not terminal and controls.is_paused(task_id):
                yield sse({"type": "paused", "task_id": task_id})
            await asyncio.sleep(0.8)

    return StreamingResponse(
        event_stream(), media_type="text/event-stream", headers=SSE_HEADERS
    )


@router.post("/{task_id}/pause")
async def pause_task(task_id: str) -> dict:
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status in TERMINAL:
        raise HTTPException(status_code=409, detail="Task already finished")
    controls.pause(task_id)
    await repo.update_task(task_id, status="paused")
    await repo.add_task_event(
        task_id,
        kind="task.paused",
        level="warning",
        message="Task paused",
        detail="Execution pauses at the next step checkpoint.",
    )
    return {"id": task_id, "status": "paused"}


@router.post("/{task_id}/resume")
async def resume_task(task_id: str) -> dict:
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    controls.resume(task_id)
    if task.status == "paused":
        await repo.update_task(task_id, status="running")
    await repo.add_task_event(
        task_id,
        kind="task.resumed",
        level="info",
        message="Task resumed",
        detail="Execution continues from the next checkpoint.",
    )
    return {"id": task_id, "status": "running"}


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str) -> dict:
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status in TERMINAL:
        return {"id": task.id, "status": task.status}
    controls.cancel(task_id)
    await repo.update_task(
        task_id,
        status="cancelled",
        error="Cancelled by user",
        finished_at=datetime.now(UTC),
    )
    await repo.add_task_event(
        task_id,
        kind="task.cancelled",
        level="warning",
        message="Task cancelled by user",
        detail="No further steps will run.",
    )
    return {"id": task_id, "status": "cancelled"}


async def _rerun(task) -> None:
    meta = task.meta or {}
    request = OrchestratorRequest(
        message=task.prompt,
        user_id=repo.DEMO_USER_ID,
        conversation_id=task.conversation_id,
        agent_slug=task.agent,
        model_role=meta.get("model_role"),
    )
    try:
        async for _ in orchestrator.run(request):
            pass
    except Exception:  # pragma: no cover - background safety net
        return


@router.post("/{task_id}/retry")
async def retry_task(task_id: str) -> dict:
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.prompt.strip():
        raise HTTPException(status_code=400, detail="Task has no prompt to retry")
    await repo.add_task_event(
        task_id,
        kind="task.retried",
        level="info",
        message="Retry requested",
        detail="A new task was queued with the same prompt.",
    )
    asyncio.create_task(_rerun(task))
    return {"id": task_id, "status": "retried"}


@router.post("/{task_id}/approve")
async def approve_task(task_id: str, approved: bool = True) -> dict:
    """Approve or reject a pending sensitive action."""
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    meta = {**(task.meta or {}), "approved": approved}
    await repo.update_task(task_id, meta=meta)
    await repo.add_task_event(
        task_id,
        kind="approval.approved" if approved else "approval.rejected",
        level="success" if approved else "warning",
        message="Action approved" if approved else "Action rejected",
        detail="Recorded against this task.",
        data={"approved": approved},
    )
    return {"id": task_id, "approved": approved, "pending": bool(task.meta.get("approval_request"))}


@router.post("/{task_id}/reject")
async def reject_task(task_id: str) -> dict:
    return await approve_task(task_id, approved=False)
