"""Server-Sent Events helpers shared by streaming endpoints."""

from __future__ import annotations

import json
from typing import Any

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def sse(event: dict[str, Any]) -> str:
    return (
        f"event: {event.get('type', 'message')}\n"
        f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    )
