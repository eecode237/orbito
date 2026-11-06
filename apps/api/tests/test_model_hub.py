"""Model Hub tests — Ollama is faked at the HTTP transport layer."""

from __future__ import annotations

import json

import httpx
from fastapi.testclient import TestClient

from app.api.v1 import model_hub as model_hub_api
from app.core.model_gateway.hub import ModelHub, is_valid_model_name
from app.main import app


def _handler(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    if path == "/api/version":
        return httpx.Response(200, json={"version": "0.40.15"})
    if path == "/api/tags":
        return httpx.Response(
            200,
            json={
                "models": [
                    {
                        "name": "qwen3.5:4b",
                        "size": 3_300_000_000,
                        "details": {
                            "family": "qwen3",
                            "parameter_size": "4B",
                            "quantization_level": "Q4_K_M",
                        },
                    }
                ]
            },
        )
    if path == "/api/ps":
        return httpx.Response(
            200,
            json={
                "models": [
                    {
                        "name": "qwen3.5:4b",
                        "size": 5_700_000_000,
                        "size_vram": 5_700_000_000,
                        "context_length": 8192,
                        "details": {},
                    }
                ]
            },
        )
    if path == "/api/show":
        return httpx.Response(
            200,
            json={
                "details": {"family": "qwen3", "parameter_size": "4B"},
                "capabilities": ["completion", "tools", "thinking", "vision"],
                "model_info": {"qwen3.context_length": 262144},
            },
        )
    if path == "/api/pull":
        lines = [
            {"status": "pulling manifest"},
            {
                "status": "pulling",
                "digest": "sha256:abc",
                "total": 100,
                "completed": 40,
            },
            {"status": "success"},
        ]
        body = "\n".join(json.dumps(line) for line in lines) + "\n"
        return httpx.Response(200, content=body.encode())
    if path == "/api/delete":
        payload = json.loads(request.content)
        if payload.get("model") == "missing:1b":
            return httpx.Response(404, json={"error": "not found"})
        return httpx.Response(200, json={})
    return httpx.Response(404, json={"error": "not found"})


def _hub(handler=_handler) -> ModelHub:
    return ModelHub(
        base_url="http://ollama.test",
        transport=httpx.MockTransport(handler),
    )


def _offline(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("connection refused")


def test_model_name_validation():
    assert is_valid_model_name("qwen3.5:4b")
    assert is_valid_model_name("library/qwen2.5-coder:7b")
    assert not is_valid_model_name("../etc/passwd")
    assert not is_valid_model_name("bad name")
    assert not is_valid_model_name("")


def test_overview_reports_models_hardware_and_suggestions(monkeypatch):
    monkeypatch.setattr(model_hub_api, "hub", _hub())
    with TestClient(app) as client:
        response = client.get("/api/v1/model-hub/overview")
        assert response.status_code == 200, response.text
        payload = response.json()

    assert payload["ollama"]["reachable"] is True
    assert payload["ollama"]["version"] == "0.40.15"
    assert payload["installed"][0]["name"] == "qwen3.5:4b"
    assert payload["installed"][0]["quantization"] == "Q4_K_M"
    assert payload["running"][0]["processor"] == "gpu"
    assert payload["running"][0]["context_length"] == 8192
    assert payload["hardware"]["memory_total_bytes"] > 0
    assert payload["hardware"]["cpu_model"]
    assert payload["suggestions"]
    installed = [item for item in payload["suggestions"] if item["name"] == "qwen3.5:4b"]
    assert installed and installed[0]["installed"] is True


def test_overview_when_ollama_is_down(monkeypatch):
    monkeypatch.setattr(model_hub_api, "hub", _hub(_offline))
    with TestClient(app) as client:
        response = client.get("/api/v1/model-hub/overview")
        assert response.status_code == 200, response.text
        payload = response.json()

    assert payload["ollama"]["reachable"] is False
    assert "ollama serve" in payload["ollama"]["error"]
    assert payload["installed"] == []
    assert payload["running"] == []


def test_pull_streams_progress_and_done(monkeypatch):
    monkeypatch.setattr(model_hub_api, "hub", _hub())
    with TestClient(app) as client:
        with client.stream(
            "POST",
            "/api/v1/model-hub/pull",
            json={"name": "qwen3.5:4b"},
        ) as stream:
            assert stream.status_code == 200
            body = "".join(stream.iter_text())

    assert "event: progress" in body
    assert '"percent": 40.0' in body
    assert "event: done" in body


def test_pull_rejects_invalid_name(monkeypatch):
    monkeypatch.setattr(model_hub_api, "hub", _hub())
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/model-hub/pull", json={"name": "../etc/passwd"}
        )
    assert response.status_code == 422


def test_pull_requires_a_reachable_server(monkeypatch):
    monkeypatch.setattr(model_hub_api, "hub", _hub(_offline))
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/model-hub/pull", json={"name": "qwen3.5:4b"}
        )
    assert response.status_code == 503


def test_show_and_delete(monkeypatch):
    monkeypatch.setattr(model_hub_api, "hub", _hub())
    with TestClient(app) as client:
        shown = client.get(
            "/api/v1/model-hub/models/show", params={"name": "qwen3.5:4b"}
        )
        assert shown.status_code == 200, shown.text
        assert shown.json()["context_length"] == 262144
        assert "tools" in shown.json()["capabilities"]

        removed = client.delete(
            "/api/v1/model-hub/models", params={"name": "qwen3.5:4b"}
        )
        assert removed.status_code == 204

        missing = client.delete(
            "/api/v1/model-hub/models", params={"name": "missing:1b"}
        )
        assert missing.status_code == 404


def test_hardware_endpoint(monkeypatch):
    monkeypatch.setattr(model_hub_api, "hub", _hub())
    with TestClient(app) as client:
        response = client.get("/api/v1/model-hub/hardware")
    assert response.status_code == 200
    payload = response.json()
    assert payload["platform"]
    assert payload["cpu_threads"]
    assert isinstance(payload["gpus"], list)
