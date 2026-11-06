"""Chat — the primary interaction endpoint.

`POST /chat` streams Server-Sent Events by default:
  conversation → task.created → step.updated* → delta* → done | error
Set `"stream": false` for a single JSON response.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.api.schemas import ChatRequest, ChatResponse
from app.api.sse import SSE_HEADERS, sse
from app.core.model_gateway import Message as GatewayMessage
from app.core.orchestrator import OrchestratorRequest, orchestrator
from app.db import repositories as repo

router = APIRouter(tags=["chat"])



async def _history(conversation_id: str | None) -> list[GatewayMessage]:
    if not conversation_id:
        return []
    rows = await repo.list_messages(conversation_id, limit=14)
    return [
        GatewayMessage(role="assistant" if row.role == "assistant" else "user", content=row.content)
        for row in rows
        if row.role in ("user", "assistant") and row.content
    ]


@router.post("/chat")
async def chat(payload: ChatRequest):
    conversation_id = await repo.get_or_create_conversation(
        payload.conversation_id,
        title=payload.message[:80],
        agent=payload.agent,
        model_role=payload.model_role,
    )
    history = await _history(conversation_id)

    if conversation_id:
        await repo.add_message(
            conversation_id=conversation_id,
            role="user",
            content=payload.message,
            meta={"agent": payload.agent, "model_role": payload.model_role},
        )

    request = OrchestratorRequest(
        message=payload.message,
        user_id=repo.DEMO_USER_ID,
        conversation_id=conversation_id,
        agent_slug=payload.agent,
        model_role=payload.model_role,
        history=history,
        workspace_id=payload.workspace_id,
    )

    if not payload.stream:
        answer = ""
        task_id = None
        agent = None
        model = None
        usage = None
        cost = 0.0
        async for event in orchestrator.run(request):
            if event["type"] == "done":
                answer = event.get("message", "")
                task_id = event.get("task_id")
                agent = event.get("agent")
                model = event.get("model")
                usage = event.get("usage")
                cost = float(event.get("cost_usd") or 0)
            elif event["type"] == "error":
                raise HTTPException(status_code=502, detail=event.get("error", "Generation failed"))
        return ChatResponse(
            task_id=task_id,
            conversation_id=conversation_id,
            message=answer,
            agent=agent,
            model=model,
            usage=usage,
            cost_usd=cost,
        )

    async def event_stream() -> AsyncIterator[str]:
        yield sse(
            {
                "type": "conversation",
                "conversation_id": conversation_id,
            }
        )
        try:
            async for event in orchestrator.run(request):
                event["conversation_id"] = conversation_id
                yield sse(event)
        except Exception as exc:  # pragma: no cover - stream safety net
            yield sse({"type": "error", "error": str(exc), "conversation_id": conversation_id})

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=SSE_HEADERS)
