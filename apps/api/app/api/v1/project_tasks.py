"""User-managed project backlog, daily planning and execution links."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response

from app.api.schemas import ChatRequest, ProjectWorkItemCreate, ProjectWorkItemUpdate
from app.api.v1.chat import chat as run_chat
from app.db import repositories as repo

router = APIRouter(prefix="/project-tasks", tags=["project-tasks"])

STATUSES = ("backlog", "todo", "in_progress", "blocked", "done")


def _item_payload(item, execution_status: str | None = None) -> dict[str, Any]:
    return {
        "id": item.id,
        "key": item.key,
        "title": item.title,
        "description": item.description,
        "status": item.status,
        "priority": item.priority,
        "scheduled_for": item.scheduled_for,
        "due_date": item.due_date,
        "estimate_minutes": item.estimate_minutes,
        "labels": item.labels or [],
        "execution_task_id": item.execution_task_id,
        "execution_status": execution_status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
    }


@router.get("/board")
async def board(
    target_date: date = Query(default_factory=date.today),
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=300, ge=1, le=500),
) -> dict[str, Any]:
    """Return real board items and counts for a local-calendar planning date."""
    items = await repo.list_project_work_items(query=q, limit=limit)
    total = await repo.count_project_work_items(query=q)
    tomorrow = target_date + timedelta(days=1)
    counts = {status: 0 for status in STATUSES}
    scheduled_today = 0
    scheduled_tomorrow = 0
    for item in items:
        if item.status in counts:
            counts[item.status] += 1
        if item.status != "done" and item.scheduled_for == target_date.isoformat():
            scheduled_today += 1
        if item.status != "done" and item.scheduled_for == tomorrow.isoformat():
            scheduled_tomorrow += 1
    execution_ids = {item.execution_task_id for item in items if item.execution_task_id}
    execution_statuses = await repo.get_task_statuses(execution_ids)
    return {
        "items": [
            _item_payload(item, execution_statuses.get(item.execution_task_id or ""))
            for item in items
        ],
        "total": total,
        "limit": limit,
        "truncated": total > len(items),
        "target_date": target_date.isoformat(),
        "tomorrow": tomorrow.isoformat(),
        "counts": {
            **counts,
            "scheduled_today": scheduled_today,
            "scheduled_tomorrow": scheduled_tomorrow,
        },
    }


@router.post("", status_code=201)
async def create(payload: ProjectWorkItemCreate) -> dict[str, Any]:
    item = await repo.create_project_work_item(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        scheduled_for=payload.scheduled_for.isoformat() if payload.scheduled_for else None,
        due_date=payload.due_date.isoformat() if payload.due_date else None,
        estimate_minutes=payload.estimate_minutes,
        labels=payload.labels,
    )
    if not item:
        raise HTTPException(status_code=503, detail="Task store unavailable")
    return {"item": _item_payload(item)}


@router.get("/{item_id}")
async def get(item_id: str) -> dict[str, Any]:
    item = await repo.get_project_work_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Project task not found")
    execution_statuses = await repo.get_task_statuses(
        {item.execution_task_id} if item.execution_task_id else set()
    )
    return {
        "item": _item_payload(
            item, execution_statuses.get(item.execution_task_id or "")
        )
    }


@router.patch("/{item_id}")
async def update(item_id: str, payload: ProjectWorkItemUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        item = await repo.get_project_work_item(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Project task not found")
        return {"item": _item_payload(item)}
    for required in ("title", "description", "status", "priority", "labels"):
        if required in fields and fields[required] is None:
            raise HTTPException(status_code=422, detail=f"{required} cannot be null")
    if "scheduled_for" in fields:
        fields["scheduled_for"] = (
            fields["scheduled_for"].isoformat() if fields["scheduled_for"] else None
        )
    if "due_date" in fields:
        fields["due_date"] = fields["due_date"].isoformat() if fields["due_date"] else None
    if "title" in fields and fields["title"] is not None:
        fields["title"] = fields["title"].strip()
    if "description" in fields and fields["description"] is not None:
        fields["description"] = fields["description"].strip()
    item = await repo.update_project_work_item(item_id, fields=fields)
    if not item:
        raise HTTPException(status_code=404, detail="Project task not found")
    return {"item": _item_payload(item)}


@router.delete("/{item_id}", status_code=204)
async def delete(item_id: str) -> Response:
    if not await repo.delete_project_work_item(item_id):
        raise HTTPException(status_code=404, detail="Project task not found")
    return Response(status_code=204)


@router.post("/{item_id}/run")
async def run_project_task(item_id: str) -> dict[str, Any]:
    """Start a real ORBITO run for this item. The run is linked back to the item by the runner."""
    item = await repo.get_project_work_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Project task not found")
    if item.status == "done":
        raise HTTPException(
            status_code=409,
            detail="This project task is already marked done. Reopen it before starting another run.",
        )
    message = f"Work on {item.key}: {item.title}"
    if item.description:
        message += f"\n\nContext:\n{item.description}"
    response = await run_chat(
        ChatRequest(message=message, agent="core", project_task_id=item_id, stream=False)
    )
    refreshed = await repo.get_project_work_item(item_id)
    return {
        "task_id": response.task_id,
        "message": response.message,
        "model": response.model,
        "cost_usd": response.cost_usd,
        "item": _item_payload(refreshed) if refreshed else None,
    }
