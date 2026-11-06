"""Memory retrieval and explicit "remember this" capture.

Three levels are planned (conversation, workspace, long-term). Foundation v0.1
wires conversation history plus long-term user memories, and gives users full
control to inspect and delete them.
"""

from __future__ import annotations

import re

from app.db import repositories as repo
from app.db.models import Memory


async def recall(user_id: str, limit: int = 8) -> str:
    memories: list[Memory] = await repo.list_memories(user_id, limit=limit)
    if not memories:
        return ""
    lines = [f"- {memory.content}" for memory in memories if memory.content]
    return "\n".join(lines)


async def maybe_capture(user_id: str, message: str, workspace_id: str | None = None) -> str | None:
    match = re.match(
        r"^\s*(?:please\s+)?remember(?:\s+that)?[:,]?\s+(?P<fact>.+)$",
        message,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    fact = match.group("fact").strip()
    if not fact:
        return None
    return await repo.add_memory(fact, workspace_id=workspace_id, user_id=user_id)


def build_system_prompt(
    base: str,
    *,
    agent_prompt: str,
    memory: str,
    tool_context: str,
    approvals: list[str],
) -> str:
    parts = [
        "You are ORBITO — the user's personal AI operating system.",
        "Answer in clear Markdown. Be concrete, cite sources when tools return them, and",
        "never claim an external action happened unless a tool confirmed it.",
        "",
        agent_prompt,
    ]
    if memory:
        parts += ["", "What you remember about this user:", memory]
    if tool_context:
        parts += ["", "Live tool output for this request:", tool_context]
    if approvals:
        parts += [
            "",
            "Actions that require explicit human approval (never auto-run):",
            *[f"- {item}" for item in approvals],
        ]
    return "\n".join(parts)
