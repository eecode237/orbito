"""Workflow definition CRUD and honest run records."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_workflow_crud_and_manual_run():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/workflows",
            json={
                "name": "Daily briefing",
                "description": "Collect news and summarize it.",
                "trigger": {"type": "schedule", "config": {"cron": "0 8 * * *"}},
                "definition": {
                    "nodes": [
                        {"id": "n1", "type": "trigger.schedule", "label": "Every morning", "config": {"cron": "0 8 * * *"}},
                        {"id": "n2", "type": "action.chat", "label": "Summarize", "config": {"agent": "core", "prompt": "Summarize top news"}},
                    ],
                    "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
                    "version": 1,
                },
                "enabled": True,
                "status": "active",
            },
        )
        assert created.status_code == 201, created.text
        workflow = created.json()["workflow"]
        wid = workflow["id"]
        assert workflow["name"] == "Daily briefing"
        assert workflow["trigger"]["type"] == "schedule"
        assert len(workflow["definition"]["nodes"]) == 2

        listed = client.get("/api/v1/workflows")
        assert listed.status_code == 200
        assert any(w["id"] == wid for w in listed.json()["workflows"])

        detail = client.get(f"/api/v1/workflows/{wid}")
        assert detail.status_code == 200
        assert detail.json()["workflow"]["id"] == wid

        patched = client.patch(f"/api/v1/workflows/{wid}", json={"name": "Morning briefing", "status": "paused"})
        assert patched.status_code == 200
        assert patched.json()["workflow"]["name"] == "Morning briefing"
        assert patched.json()["workflow"]["status"] == "paused"

        # Re-enable so a manual run can be queued.
        client.patch(f"/api/v1/workflows/{wid}", json={"enabled": True, "status": "active"})
        run = client.post(f"/api/v1/workflows/{wid}/runs", json={"triggered_by": "manual", "input": {"reason": "test"}})
        assert run.status_code == 201, run.text
        run_data = run.json()["run"]
        assert run_data["status"] == "pending_runner"
        assert "not executed" in (run_data["log"] or "").lower()

        runs = client.get(f"/api/v1/workflows/{wid}/runs")
        assert runs.status_code == 200
        assert any(r["id"] == run_data["id"] for r in runs.json()["runs"])

        deleted = client.delete(f"/api/v1/workflows/{wid}")
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/workflows/{wid}").status_code == 404


def test_workflow_validation_and_disabled_run():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/workflows",
            json={"name": "Disabled flow", "enabled": False},
        )
        assert created.status_code == 201
        wid = created.json()["workflow"]["id"]
        assert created.json()["workflow"]["trigger"]["type"] == "manual"
        assert created.json()["workflow"]["definition"]["nodes"] == []

        blocked = client.post(f"/api/v1/workflows/{wid}/runs", json={})
        assert blocked.status_code == 409

        assert client.post("/api/v1/workflows", json={"name": "   "}).status_code == 422
