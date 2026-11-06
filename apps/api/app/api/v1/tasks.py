"""Task inspection and control."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from app.db import repositories as repo

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _task_payload(task) -> dict:
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
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "finished_at": task.finished_at.isoformat() if task.finished_at else None,
        "steps": [
            {
                "index": step.index,
                "title": step.title,
                "status": step.status,
                "detail": step.detail,
                "tool": step.tool,
            }
            for step in sorted(task.steps, key=lambda item: item.index)
        ],
    }


@router.get("")
async def list_tasks(limit: int = 25) -> dict:
    tasks = await repo.list_tasks(limit=min(limit, 100))
    return {"tasks": [_task_payload(task) for task in tasks]}


@router.get("/{task_id}")
async def get_task(task_id: str) -> dict:
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_payload(task)


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str) -> dict:
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status in {"completed", "failed", "cancelled"}:
        return {"id": task.id, "status": task.status}
    await repo.update_task(
        task_id, status="cancelled", finished_at=datetime.now(UTC), error="Cancelled by user"
    )
    return {"id": task_id, "status": "cancelled"}


@router.post("/{task_id}/approve")
async def approve_task(task_id: str, approved: bool = True) -> dict:
    """Approval gate for sensitive actions (Phase 3 expands this into a queue)."""
    task = await repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await repo.update_task(task_id, meta={**(task.meta or {}), "approved": approved})
    return {"id": task_id, "approved": approved}
