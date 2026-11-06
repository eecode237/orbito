"""Document text extraction (PDF, text, markdown, CSV, JSON)."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from app.config import settings
from app.tools.base import Tool, ToolPermission, ToolResult

TEXT_SUFFIXES = {".txt", ".md", ".markdown", ".csv", ".json", ".log", ".yaml", ".yml"}


def _resolve(path: str) -> Path:
    root = settings.upload_path.resolve()
    candidate = (root / path).resolve() if not Path(path).is_absolute() else Path(path).resolve()
    if root not in candidate.parents and candidate != root:
        raise ValueError("Path escapes the ORBITO upload sandbox.")
    if not candidate.exists() or not candidate.is_file():
        raise ValueError(f"File not found: {path}")
    return candidate


def _extract_sync(path: Path) -> dict[str, Any]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return {"kind": "pdf", "pages": len(pages), "text": "\n\n".join(pages)}
    if suffix in TEXT_SUFFIXES:
        text = path.read_text(encoding="utf-8", errors="ignore")
        return {"kind": suffix.lstrip("."), "pages": 1, "text": text}
    raise ValueError(f"Unsupported document type: {suffix or 'unknown'}")


class DocumentTool(Tool):
    name = "documents"
    description = "Extract text from an uploaded PDF or text document."
    permission = ToolPermission.AUTO
    timeout = 60.0

    async def run(self, path: str, **_: Any) -> ToolResult:
        try:
            file_path = _resolve(path)
            data = await asyncio.to_thread(_extract_sync, file_path)
        except Exception as exc:
            return ToolResult(ok=False, error=str(exc))
        text = data.pop("text", "")
        return ToolResult(
            ok=True,
            summary=f"{file_path.name} — {data.get('pages', 0)} page(s)\n\n{text[:1500]}",
            data={**data, "name": file_path.name, "text": text[:200_000]},
        )


documents = DocumentTool()
