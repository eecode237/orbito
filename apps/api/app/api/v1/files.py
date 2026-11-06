"""Workspace file uploads."""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import settings
from app.db import repositories as repo

router = APIRouter(prefix="/files", tags=["files"])

MAX_BYTES = 25 * 1024 * 1024


@router.post("/upload", status_code=201)
async def upload_file(file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="A filename is required")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB limit")

    safe_name = Path(file.filename).name
    key = f"{uuid.uuid4().hex}-{safe_name}"
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    target = settings.upload_path / key

    def _write() -> None:
        target.write_bytes(data)

    await asyncio.to_thread(_write)

    file_id = await repo.create_file(
        name=safe_name,
        storage_key=key,
        size=len(data),
        mime=file.content_type or "application/octet-stream",
    )
    return {
        "id": file_id,
        "name": safe_name,
        "size": len(data),
        "mime": file.content_type,
        "storage_key": key,
    }


@router.get("")
async def list_files() -> dict:
    files = await repo.list_files()
    return {
        "files": [
            {
                "id": item.id,
                "name": item.name,
                "size": item.size,
                "mime": item.mime,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in files
        ]
    }
