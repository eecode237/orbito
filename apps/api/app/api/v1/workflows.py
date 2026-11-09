"""Automation workflows: n8n-like definitions, triggers and execution records.

Workflow definitions are real DB records. Execution is recorded as WorkflowRun rows.
Autonomous/scheduled execution requires the workflow runner (planned); manual runs
create an honest `pending_runner` record rather than fabricating execution.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response

from app.api.schemas import WorkflowCreate, WorkflowRunCreate, WorkflowUpdate
from app.db import repositories as repo

router = APIRouter(prefix="/workflows", tags=["workflows"])


def _workflow_payload(item) -> dict[str, Any]:
    definition = item.definition or {"nodes": [], "edges": [], "version": 1}
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "status": item.status,
        "trigger": item.trigger or {"type": "manual", "config": {}},
        "definition": {
            "nodes": definition.get("nodes") or [],
            "edges": definition.get("edges") or [],
            "version": definition.get("version", 1),
            **{k: v for k, v in definition.items() if k not in {"nodes", "edges", "version"}},
        },
        "enabled": item.enabled,
        "run_count": item.run_count or 0,
        "last_run_at": item.last_run_at.isoformat() if item.last_run_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _run_payload(item) -> dict[str, Any]:
    return {
        "id": item.id,
        "workflow_id": item.workflow_id,
        "status": item.status,
        "triggered_by": item.triggered_by,
        "input": item.input or {},
        "output": item.output or {},
        "error": item.error,
        "log": item.log,
        "started_at": item.started_at.isoformat() if item.started_at else None,
        "finished_at": item.finished_at.isoformat() if item.finished_at else None,
        "created_at": item.created_at.isoformat() if getattr(item, "created_at", None) else None,
    }


@router.get("")
async def list_workflows(
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    items = await repo.list_workflows(query=q, limit=limit, offset=offset)
    total = await repo.count_workflows(query=q)
    return {"workflows": [_workflow_payload(item) for item in items], "total": total, "limit": limit, "offset": offset}


@router.post("", status_code=201)
async def create_workflow(payload: WorkflowCreate) -> dict[str, Any]:
    item = await repo.create_workflow(
        name=payload.name,
        description=payload.description,
        trigger=payload.trigger,
        definition=payload.definition,
        enabled=payload.enabled,
        status=payload.status,
    )
    if not item:
        raise HTTPException(status_code=503, detail="Workflow store unavailable")
    return {"workflow": _workflow_payload(item)}


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str) -> dict[str, Any]:
    item = await repo.get_workflow(workflow_id)
    if not item:
        raise HTTPException(status_code=404, detail="Workflow not found")
    runs = await repo.list_workflow_runs(workflow_id, limit=20)
    return {"workflow": _workflow_payload(item), "runs": [_run_payload(run) for run in runs]}


@router.patch("/{workflow_id}")
async def update_workflow(workflow_id: str, payload: WorkflowUpdate) -> dict[str, Any]:
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        item = await repo.get_workflow(workflow_id)
        if not item:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return {"workflow": _workflow_payload(item)}
    item = await repo.update_workflow(workflow_id, fields=fields)
    if not item:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"workflow": _workflow_payload(item)}


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: str) -> Response:
    if not await repo.delete_workflow(workflow_id):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return Response(status_code=204)


@router.get("/{workflow_id}/runs")
async def list_runs(workflow_id: str, limit: int = Query(default=30, ge=1, le=100)) -> dict[str, Any]:
    item = await repo.get_workflow(workflow_id)
    if not item:
        raise HTTPException(status_code=404, detail="Workflow not found")
    runs = await repo.list_workflow_runs(workflow_id, limit=limit)
    return {"workflow_id": workflow_id, "runs": [_run_payload(run) for run in runs]}


@router.post("/{workflow_id}/runs", status_code=201)
async def create_run(workflow_id: str, payload: WorkflowRunCreate) -> dict[str, Any]:
    workflow = await repo.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not workflow.enabled:
        raise HTTPException(status_code=409, detail="Workflow is disabled. Enable it before running.")
    run = await repo.create_workflow_run(
        workflow_id,
        triggered_by=payload.triggered_by,
        input_data=payload.input,
        status="pending_runner",
        log=(
            "Run queued in the database. The autonomous workflow runner is not connected yet, "
            "so this run is recorded honestly as pending_runner (not executed, not faked). "
            "Connect triggers, node executors and external integrations to run it."
        ),
    )
    if not run:
        raise HTTPException(status_code=503, detail="Workflow run store unavailable")
    return {"run": _run_payload(run), "workflow": _workflow_payload(workflow)}
