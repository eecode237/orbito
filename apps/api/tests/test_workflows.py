"""Workflow definitions, the runner, and honest run records (real runner, real DB)."""

from __future__ import annotations

import time

from fastapi.testclient import TestClient

from app.main import app


def _wait_for_run(client: TestClient, workflow_id: str, run_id: str, timeout: float = 20.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        run = client.get(f"/api/v1/workflows/{workflow_id}/runs/{run_id}").json()["run"]
        if run["status"] not in {"queued", "running"}:
            return run
        time.sleep(0.2)
    raise AssertionError(f"run {run_id} did not finish in {timeout}s")


def _node(node_id: str, node_type: str, label: str, config: dict | None = None) -> dict:
    return {"id": node_id, "type": node_type, "label": label, "config": config or {}}


def _create(client: TestClient, name: str, nodes: list[dict], edges: list[dict], enabled: bool = True) -> str:
    created = client.post(
        "/api/v1/workflows",
        json={
            "name": name,
            "trigger": {"type": "manual", "config": {}},
            "definition": {"nodes": nodes, "edges": edges, "version": 1},
            "enabled": enabled,
            "status": "active",
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["workflow"]["id"]


def test_workflow_crud_and_runner_executes_chain():
    with TestClient(app) as client:
        wid = _create(
            client,
            "Daily briefing",
            [
                _node("t", "trigger.manual", "Start"),
                _node("c", "action.chat", "Summarize", {"prompt": "Summarize: {{input}}"}),
                _node("x", "transform", "Wrap", {"template": "Briefing -> {{previous}}"}),
            ],
            [{"id": "e1", "source": "t", "target": "c"}, {"id": "e2", "source": "c", "target": "x"}],
        )

        listed = client.get("/api/v1/workflows")
        assert any(w["id"] == wid for w in listed.json()["workflows"])

        patched = client.patch(f"/api/v1/workflows/{wid}", json={"name": "Morning briefing", "status": "paused"})
        assert patched.json()["workflow"]["status"] == "paused"
        client.patch(f"/api/v1/workflows/{wid}", json={"status": "active"})

        queued = client.post(f"/api/v1/workflows/{wid}/runs", json={"input": {"message": "hello"}})
        assert queued.status_code == 201, queued.text
        run_id = queued.json()["run"]["id"]

        run = _wait_for_run(client, wid, run_id)
        assert run["status"] == "completed", run
        nodes = {n["id"]: n for n in run["output"]["nodes"]}
        assert [n["status"] for n in run["output"]["nodes"]] == ["completed"] * 3
        assert nodes["c"]["output"]["text"]
        assert nodes["c"]["output"]["provider"] in {"mock", "ollama", "openai", "anthropic", "google", "mistral"}
        assert run["output"]["final_text"].startswith("Briefing -> ")
        assert "Run completed." in run["log"]

        assert client.delete(f"/api/v1/workflows/{wid}").status_code == 204
        assert client.get(f"/api/v1/workflows/{wid}").status_code == 404


def test_condition_routes_only_matching_branch():
    with TestClient(app) as client:
        wid = _create(
            client,
            "Branch test",
            [
                _node("t", "trigger.manual", "Start"),
                _node("g", "transform", "Text", {"template": "urgent: server down"}),
                _node("k", "condition", "Is urgent?", {"mode": "contains", "value": "urgent"}),
                _node("yes", "transform", "Escalate", {"template": "ESCALATE"}),
                _node("no", "transform", "Ignore", {"template": "IGNORE"}),
            ],
            [
                {"id": "e1", "source": "t", "target": "g"},
                {"id": "e2", "source": "g", "target": "k"},
                {"id": "e3", "source": "k", "target": "yes", "label": "true"},
                {"id": "e4", "source": "k", "target": "no", "label": "false"},
            ],
        )
        run_id = client.post(f"/api/v1/workflows/{wid}/runs", json={}).json()["run"]["id"]
        run = _wait_for_run(client, wid, run_id)
        assert run["status"] == "completed", run
        executed = {n["id"]: n["status"] for n in run["output"]["nodes"]}
        assert executed.get("yes") == "completed"
        assert "no" not in executed
        assert run["output"]["final_text"] == "ESCALATE"


def test_unavailable_node_type_blocks_run_honestly():
    with TestClient(app) as client:
        wid = _create(
            client,
            "External call",
            [
                _node("t", "trigger.manual", "Start"),
                _node("h", "action.http", "Post to webhook", {"url": "https://example.invalid"}),
            ],
            [{"id": "e1", "source": "t", "target": "h"}],
        )
        run_id = client.post(f"/api/v1/workflows/{wid}/runs", json={}).json()["run"]["id"]
        run = _wait_for_run(client, wid, run_id)
        assert run["status"] == "failed"
        blocked = [n for n in run["output"]["nodes"] if n["id"] == "h"][0]
        assert blocked["status"] == "blocked"
        assert "not available yet" in blocked["error"]


def test_empty_prompt_fails_node_and_run():
    with TestClient(app) as client:
        wid = _create(
            client,
            "No prompt",
            [_node("t", "trigger.manual", "Start"), _node("c", "action.chat", "Chat", {"prompt": "  "})],
            [{"id": "e1", "source": "t", "target": "c"}],
        )
        run_id = client.post(f"/api/v1/workflows/{wid}/runs", json={}).json()["run"]["id"]
        run = _wait_for_run(client, wid, run_id)
        assert run["status"] == "failed"
        assert "empty prompt" in (run["error"] or "")


def test_workflow_validation_and_disabled_run():
    with TestClient(app) as client:
        created = client.post("/api/v1/workflows", json={"name": "Disabled flow", "enabled": False})
        assert created.status_code == 201
        wid = created.json()["workflow"]["id"]
        assert created.json()["workflow"]["trigger"]["type"] == "manual"
        assert created.json()["workflow"]["definition"]["nodes"] == []

        blocked = client.post(f"/api/v1/workflows/{wid}/runs", json={})
        assert blocked.status_code == 409

        assert client.post("/api/v1/workflows", json={"name": "   "}).status_code == 422
