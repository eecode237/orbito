"""Conversation history."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db import repositories as repo

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
async def list_conversations(limit: int = 30) -> dict:
    conversations = await repo.list_conversations(limit=min(limit, 100))
    return {
        "conversations": [
            {
                "id": item.id,
                "title": item.title,
                "agent": item.agent,
                "model_role": item.model_role,
                "updated_at": item.updated_at.isoformat() if item.updated_at else None,
            }
            for item in conversations
        ]
    }


@router.get("/{conversation_id}/messages")
async def list_messages(conversation_id: str) -> dict:
    conversation = await repo.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = await repo.list_messages(conversation_id, limit=200)
    return {
        "conversation_id": conversation_id,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "model": message.model,
                "provider": message.provider,
                "tokens": message.tokens,
                "created_at": message.created_at.isoformat() if message.created_at else None,
            }
            for message in messages
        ],
    }


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str) -> dict:
    deleted = await repo.delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True, "id": conversation_id}


@router.delete("")
async def clear_conversations() -> dict:
    count = await repo.clear_conversations()
    return {"deleted": True, "count": count}
