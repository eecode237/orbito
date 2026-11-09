"""Job application tracker. Records what the user applied to; it never submits anything."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response

from app.api.schemas import JobApplicationCreate, JobApplicationUpdate
from app.db import repositories as repo

router = APIRouter(prefix="/jobs/applications", tags=["jobs"])


def _payload(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "company": row.company,
        "role": row.role,
        "url": row.url,
        "status": row.status,
        "match_score": row.match_score,
        "notes": row.notes,
        "applied_at": row.applied_at.isoformat() if row.applied_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("")
async def list_applications(limit: int = Query(default=200, ge=1, le=500)) -> dict[str, Any]:
    rows = await repo.list_applications(limit=limit)
    counts: dict[str, int] = {}
    for row in rows:
        counts[row.status] = counts.get(row.status, 0) + 1
    return {"applications": [_payload(row) for row in rows], "counts": counts}


@router.post("", status_code=201)
async def create_application(payload: JobApplicationCreate) -> dict[str, Any]:
    row = await repo.create_application(**payload.model_dump())
    if row is None:
        raise HTTPException(status_code=503, detail="Application store unavailable")
    return {"application": _payload(row)}


@router.patch("/{application_id}")
async def update_application(application_id: str, payload: JobApplicationUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if fields.get("status") == "applied":
        fields["applied_at"] = datetime.now(UTC)
    row = await repo.update_application(application_id, fields=fields)
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"application": _payload(row)}


@router.delete("/{application_id}", status_code=204)
async def delete_application(application_id: str) -> Response:
    if not await repo.delete_application(application_id):
        raise HTTPException(status_code=404, detail="Application not found")
    return Response(status_code=204)

