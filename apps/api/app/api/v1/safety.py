"""Safety spine API: status, kill switch, approvals and audit.

Decisions and switch changes are accepted only from loopback callers. The model
cannot approve its own requests: it has no route to these endpoints, and the
decision must echo the exact payload hash the human saw.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.api.schemas import ApprovalCreate, ApprovalDecisionRequest, KillSwitchUpdate, PcControlUpdate
from app.api.security import require_loopback
from app.core.permissions.policy import APPROVAL, AUTOMATIC, RESTRICTED, Action
from app.core.safety import (
    ActionDenied,
    kill_switch_engaged,
    pc_control_enabled,
    request_approval,
)
from app.core.workflows import engine as workflow_engine
from app.db import repositories as repo

router = APIRouter(tags=["safety"])

def _approval_payload(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "action": row.action,
        "summary": row.summary,
        "payload": row.payload or {},
        "payload_hash": row.payload_hash,
        "status": row.status,
        "requested_by": row.requested_by,
        "decision_note": row.decision_note,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "decided_at": row.decided_at.isoformat() if row.decided_at else None,
        "consumed_at": row.consumed_at.isoformat() if row.consumed_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _audit_payload(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "action": row.action,
        "resource": row.resource,
        "outcome": row.outcome,
        "detail": row.detail or {},
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/safety/status")
async def safety_status() -> dict[str, Any]:
    pending = await repo.list_approvals(status="pending", limit=500)
    return {
        "kill_switch": {"engaged": await kill_switch_engaged()},
        "pc_control": {"enabled": await pc_control_enabled(), "executors_installed": False},
        "loopback_only": True,
        "pending_approvals": len(pending),
        "actions": {
            "automatic": sorted(a.value for a in AUTOMATIC),
            "approval": sorted(a.value for a in APPROVAL),
            "restricted": sorted(a.value for a in RESTRICTED),
        },
    }


@router.post("/safety/kill-switch")
async def set_kill_switch(payload: KillSwitchUpdate, request: Request) -> dict[str, Any]:
    require_loopback(request)
    await repo.set_runtime_setting("kill_switch", {"engaged": payload.engaged})
    await repo.record_audit(
        "safety.kill_switch",
        resource="kill_switch",
        outcome="engaged" if payload.engaged else "released",
        detail={"client": request.client.host if request.client else None},
    )
    if payload.engaged:
        await repo.create_notification(
            title="Kill switch engaged", body="All sensitive actions are now denied.", kind="safety"
        )
    return {"kill_switch": {"engaged": payload.engaged}}


@router.post("/safety/pc-control")
async def set_pc_control(payload: PcControlUpdate, request: Request) -> dict[str, Any]:
    require_loopback(request)
    await repo.set_runtime_setting("pc_control", {"enabled": payload.enabled})
    await repo.record_audit(
        "safety.pc_control",
        resource="pc_control",
        outcome="enabled" if payload.enabled else "disabled",
    )
    return {"pc_control": {"enabled": payload.enabled, "executors_installed": False}}


@router.get("/approvals")
async def list_approvals(
    status: str | None = Query(default="pending", max_length=24),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    await repo.expire_stale_approvals()
    rows = await repo.list_approvals(status=status, limit=limit)
    return {"approvals": [_approval_payload(row) for row in rows]}


@router.post("/approvals", status_code=201)
async def create_approval(payload: ApprovalCreate, request: Request) -> dict[str, Any]:
    require_loopback(request)
    try:
        row = await request_approval(
            action=payload.action,
            payload=payload.payload,
            summary=payload.summary,
            requested_by="user",
            ttl_seconds=payload.ttl_seconds,
        )
    except ActionDenied as exc:
        raise HTTPException(status_code=422, detail=f"Unknown action: {exc.action}") from exc
    if row is None:
        raise HTTPException(status_code=503, detail="Approval store unavailable")
    return {"approval": _approval_payload(row)}


@router.post("/approvals/{approval_id}/decision")
async def decide(approval_id: str, payload: ApprovalDecisionRequest, request: Request) -> dict[str, Any]:
    require_loopback(request)
    row, reason = await repo.decide_approval(
        approval_id,
        approved=payload.approved,
        payload_hash=payload.payload_hash,
        note=payload.note,
    )
    await repo.record_audit(
        "approval.decision",
        resource=row.action if row else approval_id,
        outcome=reason if reason != "ok" else ("approved" if payload.approved else "rejected"),
        detail={"approval_id": approval_id},
    )
    if reason == "not_found":
        raise HTTPException(status_code=404, detail="Approval not found")
    if reason == "ok":
        workflow_engine.wake()
    if reason != "ok" or row is None:
        raise HTTPException(status_code=409, detail=f"Approval cannot be decided: {reason}")
    return {"approval": _approval_payload(row)}


@router.get("/audit")
async def list_audit(
    action: str | None = Query(default=None, max_length=120),
    outcome: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    rows, total = await repo.list_audit(action=action, outcome=outcome, limit=limit, offset=offset)
    return {
        "events": [_audit_payload(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
