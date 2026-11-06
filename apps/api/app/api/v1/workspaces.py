"""Read-only workspace (repository) explorer."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.core import workspace as ws

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _fail(exc: ws.WorkspaceError) -> HTTPException:
    message = str(exc)
    status = 403 if "secrets" in message or "Binary" in message else 404
    return HTTPException(status_code=status, detail=message)


@router.get("")
async def list_workspaces() -> dict[str, Any]:
    return ws.overview()


@router.get("/tree")
async def tree(
    root: str | None = None,
    path: str = Query(default="", max_length=1_024),
) -> dict[str, Any]:
    try:
        return ws.tree(root, path)
    except ws.WorkspaceError as exc:
        raise _fail(exc) from exc


@router.get("/file")
async def file(
    path: str = Query(min_length=1, max_length=1_024),
    root: str | None = None,
) -> dict[str, Any]:
    try:
        return ws.read_file(root, path)
    except ws.WorkspaceError as exc:
        raise _fail(exc) from exc


@router.get("/search")
async def search(
    q: str = Query(min_length=2, max_length=200),
    root: str | None = None,
    limit: int = Query(default=40, ge=1, le=100),
) -> dict[str, Any]:
    try:
        return ws.search(root, q, limit)
    except ws.WorkspaceError as exc:
        raise _fail(exc) from exc
