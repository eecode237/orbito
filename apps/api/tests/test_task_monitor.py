"""Agent Monitor contracts: real events, metrics and task controls."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def _run_task(client: TestClient, prompt: str = "Plan a focused work week") -> str:
    response = client.post(
        "/api/v1/chat",
        json={"message": prompt, "agent": "core", "model_role": "fast", "stream": False},
    )
    assert response.status_code == 200, response.text
    return response.json()["task_id"]


def test_events_trace_a_real_execution():
    with TestClient(app) as client:
        task_id = _run_task(client, "Monitor this task end to end")

        detail = client.get(f"/api/v1/tasks/{task_id}")
        assert detail.status_code == 200, detail.text
        payload = detail.json()
        assert payload["status"] == "completed"
        assert payload["usage"]["total_tokens"] >= 0
        assert payload["steps"]
        assert all(step["started_at"] for step in payload["steps"])

        events = client.get(f"/api/v1/tasks/{task_id}/events").json()["events"]
        kinds = {event["kind"] for event in events}
        assert {
            "task.created",
            "agent.selected",
            "model.selected",
            "model.request",
            "task.completed",
        } <= kinds
        assert all(event["message"] for event in events)


def test_metrics_and_filtered_history():
    with TestClient(app) as client:
        task_id = _run_task(client, "Unique monitor filter phrase alpha")

        metrics = client.get("/api/v1/tasks/metrics").json()
        assert metrics["counts"]["all"] >= 1
        assert metrics["counts"]["completed"] >= 1
        assert isinstance(metrics["active_agents"], list)

        filtered = client.get(
            "/api/v1/tasks", params={"q": "monitor filter phrase alpha", "limit": 5}
        ).json()
        assert filtered["total"] >= 1
        assert any(task["id"] == task_id for task in filtered["tasks"])

        completed = client.get("/api/v1/tasks", params={"status": "completed"}).json()
        assert all(task["status"] == "completed" for task in completed["tasks"])


def test_controls_are_honest_about_finished_tasks():
    with TestClient(app) as client:
        task_id = _run_task(client, "Finish quickly")

        paused = client.post(f"/api/v1/tasks/{task_id}/pause")
        assert paused.status_code == 409

        cancelled = client.post(f"/api/v1/tasks/{task_id}/cancel").json()
        assert cancelled["status"] == "completed"

        approved = client.post(f"/api/v1/tasks/{task_id}/approve").json()
        assert approved["approved"] is True
        assert approved["pending"] is False

        retried = client.post(f"/api/v1/tasks/{task_id}/retry")
        assert retried.status_code == 200
        assert retried.json()["status"] == "retried"
