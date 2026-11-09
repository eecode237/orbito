"""Workspace explorer tests — path safety, search and secret redaction."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import settings
from app.core.memory.store import build_system_prompt
from app.main import app


def _seed(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("def hello():\n    return 'orbito'\n")
    (tmp_path / "README.md").write_text("# Demo\n\nA workspace fixture.\n")
    (tmp_path / ".env").write_text("OPENAI_API_KEY=super-secret\n")
    (tmp_path / ".env.example").write_text("OPENAI_API_KEY=\n")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "lib.js").write_text("ignore me\n")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("[core]\n")
    return tmp_path


def _client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "workspace_roots", str(tmp_path))
    return TestClient(app)


def test_overview_tree_and_file(tmp_path, monkeypatch):
    _seed(tmp_path)
    with _client(tmp_path, monkeypatch) as client:
        overview = client.get("/api/v1/workspaces")
        assert overview.status_code == 200, overview.text
        root = overview.json()["default"]
        assert overview.json()["roots"][0]["files"] == 4

        tree = client.get("/api/v1/workspaces/tree", params={"root": root})
        assert tree.status_code == 200, tree.text
        names = {entry["name"] for entry in tree.json()["entries"]}
        assert {"src", "README.md", ".env", ".env.example"} <= names
        assert "node_modules" not in names
        assert ".git" not in names

        sub = client.get("/api/v1/workspaces/tree", params={"root": root, "path": "src"})
        assert sub.json()["entries"][0]["path"] == "src/main.py"

        file = client.get(
            "/api/v1/workspaces/file", params={"root": root, "path": "src/main.py"}
        )
        assert file.status_code == 200, file.text
        assert file.json()["language"] == "Python"
        assert "def hello" in file.json()["content"]
        assert file.json()["lines"] == 3

        example = client.get(
            "/api/v1/workspaces/file", params={"root": root, "path": ".env.example"}
        )
        assert example.status_code == 200
        assert example.json()["content"].replace("\r\n", "\n") == "OPENAI_API_KEY=\n"


def test_secrets_and_traversal_are_blocked(tmp_path, monkeypatch):
    _seed(tmp_path)
    with _client(tmp_path, monkeypatch) as client:
        secret = client.get(
            "/api/v1/workspaces/file", params={"path": ".env"}
        )
        assert secret.status_code == 403

        traversal = client.get(
            "/api/v1/workspaces/file", params={"path": "../../etc/passwd"}
        )
        assert traversal.status_code == 404

        missing = client.get("/api/v1/workspaces/tree", params={"root": "nope"})
        assert missing.status_code == 404


def test_search_finds_source_and_skips_dependencies(tmp_path, monkeypatch):
    _seed(tmp_path)
    with _client(tmp_path, monkeypatch) as client:
        response = client.get("/api/v1/workspaces/search", params={"q": "orbito"})
        assert response.status_code == 200, response.text
        matches = response.json()["matches"]
        assert any(match["path"] == "src/main.py" for match in matches)

        ignored = client.get("/api/v1/workspaces/search", params={"q": "ignore me"})
        assert ignored.json()["matches"] == []

        short = client.get("/api/v1/workspaces/search", params={"q": "x"})
        assert short.status_code == 422


def test_workspace_context_is_added_to_the_prompt():
    prompt = build_system_prompt(
        "base",
        agent_prompt="agent",
        memory="",
        tool_context="",
        approvals=[],
        workspace_context="File: src/main.py\nprint('hi')",
    )
    assert "Files the user attached from the workspace" in prompt
    assert "src/main.py" in prompt
