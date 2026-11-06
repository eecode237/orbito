"""Tool registry — agents receive tools by name, never by import."""

from __future__ import annotations

from app.tools.base import Tool, ToolPermission, ToolResult
from app.tools.browser import browser
from app.tools.documents import documents
from app.tools.filesystem import delete_file, filesystem
from app.tools.web_search import web_search


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def all(self) -> list[Tool]:
        return list(self._tools.values())

    def describe(self) -> list[dict]:
        return [tool.schema_hint() for tool in self._tools.values()]

    def requires_approval(self, name: str) -> bool:
        tool = self.get(name)
        return bool(tool and tool.permission != ToolPermission.AUTO)


tools = ToolRegistry()
for _tool in (web_search, browser, documents, filesystem, delete_file):
    tools.register(_tool)

__all__ = ["Tool", "ToolPermission", "ToolResult", "ToolRegistry", "tools"]
