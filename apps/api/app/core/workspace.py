"""Read-only access to the repositories ORBITO is working on.

The explorer is intentionally conservative: every path is resolved under a
configured root, symlinks cannot escape it, dependency/build directories are
pruned, and files that look like secrets are listed but never returned.

No shell is involved. The same helpers back both the UI and the chat context
hand-off, so there is exactly one path-safety implementation.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.config import settings

IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "node_modules",
    ".next",
    ".turbo",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".data",
    "dist",
    "build",
    "coverage",
    ".idea",
    ".vscode",
}

SENSITIVE_NAMES = {
    ".env",
    ".env.local",
    ".env.production",
    "id_rsa",
    "id_ed25519",
    "credentials",
    "credentials.json",
    "secrets.yaml",
    "secrets.yml",
}

SENSITIVE_SUFFIXES = {".pem", ".key", ".p12", ".pfx"}

LANGUAGES = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TSX",
    ".js": "JavaScript",
    ".jsx": "JSX",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".md": "Markdown",
    ".css": "CSS",
    ".html": "HTML",
    ".sh": "Shell",
    ".sql": "SQL",
    ".rs": "Rust",
    ".go": "Go",
    ".java": "Java",
    ".kt": "Kotlin",
    ".dockerfile": "Dockerfile",
    ".txt": "Text",
}

TEXT_SUFFIXES = set(LANGUAGES) | {
    "",
    ".cfg",
    ".ini",
    ".conf",
    ".lock",
    ".svg",
    ".gitignore",
}


class WorkspaceError(RuntimeError):
    """A workspace path was not allowed or could not be read."""


@dataclass(frozen=True, slots=True)
class Root:
    name: str
    path: Path

    def resolve(self, relative: str = "") -> Path:
        """Resolve `relative` under this root and refuse escapes."""
        candidate = (self.path / relative).resolve()
        try:
            candidate.relative_to(self.path)
        except ValueError as exc:
            raise WorkspaceError("Path is outside this workspace.") from exc
        return candidate

    def relative(self, path: Path) -> str:
        value = path.relative_to(self.path).as_posix()
        return "" if value == "." else value


def is_sensitive(path: Path) -> bool:
    name = path.name.lower()
    if name in {".env.example", ".env.sample", ".env.template"}:
        return False
    return name in SENSITIVE_NAMES or name.startswith(".env") or path.suffix.lower() in SENSITIVE_SUFFIXES


def language_for(path: Path) -> str | None:
    if path.name.lower() == "dockerfile":
        return "Dockerfile"
    return LANGUAGES.get(path.suffix.lower())


def _roots() -> list[Root]:
    roots: list[Root] = []
    used: set[str] = set()
    for path in settings.workspace_paths:
        base = path.name or "root"
        name = base
        index = 2
        while name in used:
            name = f"{base}-{index}"
            index += 1
        used.add(name)
        roots.append(Root(name=name, path=path))
    return roots


def get_root(name: str | None = None) -> Root:
    roots = _roots()
    if not roots:
        raise WorkspaceError("No workspace roots are configured.")
    if name:
        for root in roots:
            if root.name == name:
                return root
        raise WorkspaceError(f"Unknown workspace: {name}")
    return roots[0]


def _walk(root: Root):
    for current, dirs, files in os.walk(root.path):
        dirs[:] = sorted(
            directory
            for directory in dirs
            if directory not in IGNORED_DIRS
            and not directory.startswith(".next")
            and (Path(current) / directory).resolve().is_relative_to(root.path)
        )
        for filename in sorted(files):
            path = Path(current) / filename
            try:
                if not path.resolve().is_relative_to(root.path):
                    continue
                stat = path.stat()
            except OSError:
                continue
            yield path, stat


def _is_text(path: Path) -> bool:
    suffix = path.suffix.lower()
    if suffix in TEXT_SUFFIXES or path.name.lower() in {"dockerfile", "makefile", "license"}:
        return True
    return False


def overview() -> dict:
    roots = _roots()
    payload = []
    for root in roots:
        files = 0
        size = 0
        latest: float | None = None
        if root.path.is_dir():
            for _, stat in _walk(root):
                files += 1
                size += stat.st_size
                latest = max(latest, stat.st_mtime) if latest else stat.st_mtime
                if files >= 20_000:
                    break
        payload.append(
            {
                "name": root.name,
                "path": str(root.path),
                "exists": root.path.is_dir(),
                "files": files,
                "size_bytes": size,
                "updated_at": (
                    datetime.fromtimestamp(latest, UTC).isoformat() if latest else None
                ),
            }
        )
    return {"roots": payload, "default": roots[0].name if roots else None}


def tree(root_name: str | None, relative: str = "") -> dict:
    root = get_root(root_name)
    target = root.resolve(relative)
    if not target.is_dir():
        raise WorkspaceError("Not a directory.")

    entries: list[dict] = []
    try:
        children = sorted(target.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower()))
    except OSError as exc:
        raise WorkspaceError("The directory could not be read.") from exc

    for child in children:
        name = child.name
        if name in IGNORED_DIRS:
            continue
        try:
            resolved = child.resolve()
            if not resolved.is_relative_to(root.path):
                continue
            stat = resolved.stat()
        except OSError:
            continue
        is_dir = resolved.is_dir()
        entries.append(
            {
                "name": name,
                "path": root.relative(resolved),
                "type": "dir" if is_dir else "file",
                "size": 0 if is_dir else stat.st_size,
                "language": None if is_dir else language_for(resolved),
                "sensitive": is_sensitive(resolved),
                "modified_at": datetime.fromtimestamp(stat.st_mtime, UTC).isoformat(),
            }
        )

    parent = root.relative(target.parent) if target != root.path else None
    return {
        "root": root.name,
        "path": root.relative(target),
        "parent": parent,
        "entries": entries,
    }


def read_file(root_name: str | None, relative: str) -> dict:
    root = get_root(root_name)
    path = root.resolve(relative)
    if not path.is_file():
        raise WorkspaceError("Not a file.")
    if is_sensitive(path):
        raise WorkspaceError("This file may contain secrets and is not returned.")

    stat = path.stat()
    limit = max(1_000, settings.workspace_max_file_bytes)
    with path.open("rb") as handle:
        raw = handle.read(limit + 1)
    if b"\x00" in raw[:4_096]:
        raise WorkspaceError("Binary files are not previewed.")

    truncated = len(raw) > limit
    text = raw[:limit].decode("utf-8", errors="replace")
    return {
        "root": root.name,
        "path": root.relative(path),
        "name": path.name,
        "language": language_for(path),
        "size_bytes": stat.st_size,
        "modified_at": datetime.fromtimestamp(stat.st_mtime, UTC).isoformat(),
        "truncated": truncated,
        "content": text,
        "lines": text.count("\n") + (1 if text else 0),
    }


def search(root_name: str | None, query: str, limit: int = 40) -> dict:
    root = get_root(root_name)
    needle = query.strip().lower()
    if len(needle) < 2:
        raise WorkspaceError("Enter at least two characters.")

    matches: list[dict] = []
    scanned = 0
    skipped_binary = 0
    for path, stat in _walk(root):
        if len(matches) >= limit or scanned >= 5_000:
            break
        if stat.st_size > settings.workspace_max_file_bytes * 3:
            continue
        if not _is_text(path) or is_sensitive(path):
            continue
        scanned += 1
        try:
            with path.open("rb") as handle:
                head = handle.read(4_096)
                if b"\x00" in head:
                    skipped_binary += 1
                    continue
                handle.seek(0)
                for number, line in enumerate(
                    handle.read(settings.workspace_max_file_bytes).decode(
                        "utf-8", errors="replace"
                    ).splitlines(),
                    start=1,
                ):
                    if needle in line.lower():
                        matches.append(
                            {
                                "path": root.relative(path),
                                "line": number,
                                "text": line.strip()[:240],
                                "language": language_for(path),
                            }
                        )
                        if len(matches) >= limit:
                            break
        except OSError:
            continue

    return {
        "root": root.name,
        "query": query,
        "matches": matches,
        "scanned": scanned,
        "limit_reached": len(matches) >= limit,
    }
