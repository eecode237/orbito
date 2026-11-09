"""In-app notifications: approval requests, safety changes and failed workflow runs."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.db import repositories as repo

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _payload(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "title": row.title,
        "body": row.body,
        "kind": row.kind,
        "read": bool(row.read),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("")
async def list_notifications(
    unread: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    rows = await repo.list_notifications(unread_only=unread, limit=limit)
    return {"notifications": [_payload(row) for row in rows], "unread": sum(1 for r in rows if not r.read)}


@router.post("/read-all")
async def read_all() -> dict[str, Any]:
    return {"updated": await repo.mark_notifications_read()}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str) -> dict[str, Any]:
    updated = await repo.mark_notifications_read(notification_id=notification_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Notification not found or already read")
    return {"updated": updated}

