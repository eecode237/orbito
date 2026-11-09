"""Project backlog and task-to-chat integration contracts."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_project_task_crud_and_daily_board():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/project-tasks",
            json={
                "title": "Build personal task board",
                "description": "Keep backlog separate from model execution traces.",
                "priority": "high",
                "scheduled_for": "2026-11-09",
                "due_date": "2026-11-10",
                "estimate_minutes": 90,
                "labels": ["jarvis", "planning", "jarvis"],
            },
        )
        assert created.status_code == 201, created.text
        item = created.json()["item"]
        item_id = item["id"]
        assert item["key"].startswith("ORB-")
        assert item["status"] == "backlog"
        assert item["labels"] == ["jarvis", "planning"]

        board = client.get("/api/v1/project-tasks/board?target_date=2026-11-08")
        assert board.status_code == 200, board.text
        board_data = board.json()
        assert board_data["tomorrow"] == "2026-11-09"
        assert board_data["counts"]["scheduled_tomorrow"] >= 1
        assert any(row["id"] == item_id for row in board_data["items"])

        patched = client.patch(
            f"/api/v1/project-tasks/{item_id}",
            json={"status": "todo", "priority": "urgent"},
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["item"]["status"] == "todo"
        assert patched.json()["item"]["priority"] == "urgent"

        assert client.delete(f"/api/v1/project-tasks/{item_id}").status_code == 204
        assert client.get(f"/api/v1/project-tasks/{item_id}").status_code == 404


def test_chat_execution_is_linked_to_project_work_item():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/project-tasks",
            json={"title": "Run an ORBITO planning task"},
        )
        assert created.status_code == 201, created.text
        item_id = created.json()["item"]["id"]

        response = client.post(
            "/api/v1/chat",
            json={
                "message": "Create a clear implementation outline for this item.",
                "agent": "core",
                "model_role": "fast",
                "project_task_id": item_id,
                "stream": False,
            },
        )
        assert response.status_code == 200, response.text
        execution_id = response.json()["task_id"]

        item = client.get(f"/api/v1/project-tasks/{item_id}").json()["item"]
        assert item["status"] == "in_progress"
        assert item["execution_task_id"] == execution_id
        assert item["execution_status"] == "completed"

        completed = client.patch(
            f"/api/v1/project-tasks/{item_id}", json={"status": "done"}
        )
        assert completed.status_code == 200
        assert completed.json()["item"]["completed_at"] is not None

        repeated = client.post(
            "/api/v1/chat",
            json={
                "message": "Run this completed task again.",
                "project_task_id": item_id,
                "stream": False,
            },
        )
        assert repeated.status_code == 409


def test_project_task_validates_status_priority_and_date():
    with TestClient(app) as client:
        assert client.post(
            "/api/v1/project-tasks", json={"title": "Bad status", "status": "running"}
        ).status_code == 422
        assert client.post(
            "/api/v1/project-tasks", json={"title": "Bad priority", "priority": "critical"}
        ).status_code == 422
        assert client.post(
            "/api/v1/project-tasks", json={"title": "Bad date", "scheduled_for": "tomorrow"}
        ).status_code == 422


def test_run_endpoint_starts_linked_execution_and_refuses_done_items():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/project-tasks",
            json={"title": "Draft a summary of the backlog", "description": "Keep it to five bullets."},
        )
        item_id = created.json()["item"]["id"]

        run = client.post(f"/api/v1/project-tasks/{item_id}/run")
        assert run.status_code == 200, run.text
        body = run.json()
        assert body["task_id"]
        assert body["message"].strip()
        assert body["item"]["execution_task_id"] == body["task_id"]
        assert body["item"]["status"] == "in_progress"

        execution = client.get(f"/api/v1/tasks/{body['task_id']}")
        assert execution.status_code == 200
        assert execution.json()["status"] == "completed"

        client.patch(f"/api/v1/project-tasks/{item_id}", json={"status": "done"})
        refused = client.post(f"/api/v1/project-tasks/{item_id}/run")
        assert refused.status_code == 409

        assert client.post("/api/v1/project-tasks/00000000-0000-4000-8000-00000000dead/run").status_code == 404
