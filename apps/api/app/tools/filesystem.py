"""Sandboxed file access for workspaces.

All reads and writes are confined to the upload directory. Destructive actions
are represented, never executed automatically.
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.config import settings
from app.tools.base import Tool, ToolPermission, ToolResult


def _safe_path(name: str) -> Any:
    root = settings.upload_path.resolve()
    root.mkdir(parents=True, exist_ok=True)
    candidate = (root / name).resolve()
    if root not in candidate.parents and candidate != root:
        raise ValueError("Path escapes the workspace sandbox.")
    return candidate


class FilesystemTool(Tool):
    name = "filesystem"
    description = "List, read, or write files inside the ORBITO workspace."
    permission = ToolPermission.AUTO
    timeout = 15.0

    async def run(self, action: str = "list", path: str = ".", content: str | None = None, **_: Any):
        try:
            target = _safe_path(path)
            if action == "list":
                target.mkdir(parents=True, exist_ok=True)
                entries = sorted(target.iterdir(), key=lambda item: item.name)[:200]
                data = [
                    {
                        "name": entry.name,
                        "type": "dir" if entry.is_dir() else "file",
                        "size": entry.stat().st_size if entry.is_file() else 0,
                    }
                    for entry in entries
                ]
                return ToolResult(ok=True, summary=f"{len(data)} entries in {path}", data=data)
            if action == "read":
                text = await asyncio.to_thread(
                    target.read_text, encoding="utf-8", errors="ignore"
                )
                return ToolResult(ok=True, summary=text[:2000], data={"path": path, "text": text})
            if action == "write":
                if self.permission != ToolPermission.APPROVAL:
                    return ToolResult(
                        ok=False,
                        error="Writing files requires explicit approval.",
                    )
                target.parent.mkdir(parents=True, exist_ok=True)
                await asyncio.to_thread(target.write_text, content or "", encoding="utf-8")
                return ToolResult(ok=True, summary=f"Wrote {path}", data={"path": path})
            return ToolResult(ok=False, error=f"Unsupported action: {action}")
        except Exception as exc:
            return ToolResult(ok=False, error=str(exc))


class DeleteFileTool(Tool):
    name = "delete_file"
    description = "Delete a workspace file (requires approval)."
    permission = ToolPermission.APPROVAL

    async def run(self, path: str, **_: Any) -> ToolResult:
        return ToolResult(
            ok=False,
            error="Deletion is gated: request approval before removing files.",
        )


filesystem = FilesystemTool()
delete_file = DeleteFileTool()
