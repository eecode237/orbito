"""User-controlled memory."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.schemas import MemoryCreate
from app.db import repositories as repo

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("")
async def list_memory() -> dict:
    memories = await repo.list_memories()
    return {
        "memories": [
            {
                "id": memory.id,
                "content": memory.content,
                "scope": memory.scope,
                "key": memory.key,
                "workspace_id": memory.workspace_id,
                "created_at": memory.created_at.isoformat() if memory.created_at else None,
            }
            for memory in memories
        ]
    }


@router.post("", status_code=201)
async def create_memory(payload: MemoryCreate) -> dict:
    memory_id = await repo.add_memory(
        payload.content,
        scope=payload.scope,
        key=payload.key,
        workspace_id=payload.workspace_id,
    )
    if not memory_id:
        raise HTTPException(status_code=503, detail="Memory store unavailable")
    return {"id": memory_id}


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(memory_id: str) -> None:
    if not await repo.delete_memory(memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")
