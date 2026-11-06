"""API surface tests (offline mock model, local SQLite)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_health_and_catalog():
    with TestClient(app) as client:
        health = client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"

        agents = client.get("/api/v1/agents").json()["agents"]
        assert {agent["slug"] for agent in agents} >= {
            "core",
            "career",
            "research",
            "study",
            "coding",
            "automation",
        }

        models = client.get("/api/v1/models").json()
        assert models["models"]
        assert models["providers"]


def test_chat_json_and_stream():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/chat",
            json={
                "message": "Help me plan a study week for machine learning",
                "agent": "study",
                "model_role": "fast",
                "stream": False,
            },
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["message"].strip()
        assert payload["conversation_id"]

        with client.stream(
            "POST",
            "/api/v1/chat",
            json={"message": "Hello ORBITO", "agent": "core", "model_role": "fast"},
        ) as stream:
            assert stream.status_code == 200
            body = "".join(stream.iter_text())
        assert "event: done" in body
        assert "event: delta" in body


def test_memory_crud():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/memory", json={"content": "Likes short answers", "key": "style"}
        )
        assert created.status_code in (201, 503)

        memories = client.get("/api/v1/memory")
        assert memories.status_code == 200


def test_scraping_rejects_private_urls():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/scraping/jobs",
            json={"urls": ["http://127.0.0.1:8000/health"], "config": {}},
        )
        assert response.status_code == 400
