"""Approval-gated connectors: outbound HTTP pauses for a human decision, and only the approved payload is sent."""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app.core.connectors import OutboundBlocked, validate_outbound_url
from app.main import app
import sys

engine_module = sys.modules["app.core.workflows.engine"]


def _node(node_id: str, node_type: str, label: str, config: dict | None = None) -> dict:
    return {"id": node_id, "type": node_type, "label": label, "config": config or {}}


def _workflow(client: TestClient, nodes: list[dict]) -> str:
    edges = [{"id": f"e{i}", "source": nodes[i]["id"], "target": nodes[i + 1]["id"]} for i in range(len(nodes) - 1)]
    created = client.post(
        "/api/v1/workflows",
        json={"name": "Connector test", "definition": {"nodes": nodes, "edges": edges, "version": 1}, "status": "active"},
    )
    assert created.status_code == 201, created.text
    return created.json()["workflow"]["id"]


def _wait(client: TestClient, wid: str, rid: str, statuses: set[str], timeout: float = 20.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        run = client.get(f"/api/v1/workflows/{wid}/runs/{rid}").json()["run"]
        if run["status"] in statuses:
            return run
        time.sleep(0.2)
    raise AssertionError(f"run {rid} did not reach {statuses} in {timeout}s")


def _pending_for(client: TestClient, rid: str) -> dict:
    approvals = client.get("/api/v1/approvals?status=pending").json()["approvals"]
    matches = [a for a in approvals if a["requested_by"] == f"workflow_run:{rid}"]
    assert matches, "expected a pending approval for this run"
    return matches[0]


def test_outbound_validation_blocks_private_and_credentialed_urls():
    with TestClient(app) as client:
        for url in ["http://127.0.0.1:8000/x", "http://localhost/x", "http://192.168.1.10/x", "file:///etc/passwd", "https://user:pw@example.com/"]:
            with pytest.raises(OutboundBlocked):
                client.portal.call(validate_outbound_url, url)


def test_http_node_pauses_for_approval_and_rejection_fails_without_sending(monkeypatch):
    sent: list = []

    async def fake_send(method, url, body):  # pragma: no cover - must never run
        sent.append((method, url, body))
        return {"status_code": 200, "text": "", "truncated": False, "url": url, "content_type": None}

    monkeypatch.setattr(engine_module, "send_http_request", fake_send)
    with TestClient(app) as client:
        wid = _workflow(client, [_node("t", "trigger.manual", "Start"), _node("h", "action.http", "Notify partner", {"method": "POST", "url": "https://example.com/hook", "body": {"msg": "hi"}})])
        rid = client.post(f"/api/v1/workflows/{wid}/runs", json={}).json()["run"]["id"]

        paused = _wait(client, wid, rid, {"awaiting_approval", "failed", "completed"})
        assert paused["status"] == "awaiting_approval", paused
        approval = _pending_for(client, rid)
        assert approval["action"] == "http_request"
        assert approval["payload"] == {"method": "POST", "url": "https://example.com/hook", "body": {"msg": "hi"}}

        decided = client.post(
            f"/api/v1/approvals/{approval['id']}/decision",
            json={"approved": False, "payload_hash": approval["payload_hash"], "note": "no"},
        )
        assert decided.status_code == 200

        failed = _wait(client, wid, rid, {"failed", "completed"})
        assert failed["status"] == "failed"
        assert "rejected" in (failed["error"] or "")
        assert sent == []


def test_approved_http_sends_exactly_the_approved_payload(monkeypatch):
    sent: list = []

    async def fake_send(method, url, body):
        sent.append((method, url, body))
        return {"status_code": 200, "text": "ok", "truncated": False, "url": url, "content_type": "text/plain"}

    monkeypatch.setattr(engine_module, "send_http_request", fake_send)
    with TestClient(app) as client:
        wid = _workflow(client, [_node("t", "trigger.manual", "Start"), _node("h", "action.http", "Ping", {"method": "POST", "url": "https://example.com/ping", "body": "hello {{workflow}}"})])
        rid = client.post(f"/api/v1/workflows/{wid}/runs", json={}).json()["run"]["id"]
        _wait(client, wid, rid, {"awaiting_approval"})
        approval = _pending_for(client, rid)
        assert approval["payload"]["body"] == "hello Connector test"

        client.post(
            f"/api/v1/approvals/{approval['id']}/decision",
            json={"approved": True, "payload_hash": approval["payload_hash"]},
        )
        run = _wait(client, wid, rid, {"completed", "failed"})
        assert run["status"] == "completed", run
        assert sent == [("POST", "https://example.com/ping", "hello Connector test")]
        assert run["output"]["final_text"] == "ok"

        spent = client.get("/api/v1/approvals?status=consumed").json()["approvals"]
        assert any(a["id"] == approval["id"] for a in spent)


def test_approved_request_to_private_address_is_blocked_at_execution():
    with TestClient(app) as client:
        wid = _workflow(client, [_node("t", "trigger.manual", "Start"), _node("h", "action.http", "Local", {"url": "http://127.0.0.1:9/private"})])
        rid = client.post(f"/api/v1/workflows/{wid}/runs", json={}).json()["run"]["id"]
        _wait(client, wid, rid, {"awaiting_approval"})
        approval = _pending_for(client, rid)
        client.post(f"/api/v1/approvals/{approval['id']}/decision", json={"approved": True, "payload_hash": approval["payload_hash"]})
        run = _wait(client, wid, rid, {"completed", "failed"})
        assert run["status"] == "failed"
        node = [n for n in run["output"]["nodes"] if n["id"] == "h"][0]
        assert node["status"] == "failed"
        assert "Request blocked" in node["error"]


def test_notify_node_writes_an_in_app_notification_and_audits():
    with TestClient(app) as client:
        wid = _workflow(client, [_node("t", "trigger.manual", "Start", {}), _node("n", "action.notify", "Tell me", {"title": "Daily check", "body": "Run finished"})])
        rid = client.post(f"/api/v1/workflows/{wid}/runs", json={}).json()["run"]["id"]
        run = _wait(client, wid, rid, {"completed", "failed"})
        assert run["status"] == "completed", run
        notes = client.get("/api/v1/notifications").json()["notifications"]
        assert any(n["title"] == "Daily check" and n["body"] == "Run finished" for n in notes)
        events = client.get("/api/v1/audit?action=safety.authorize&limit=100").json()["events"]
        assert any(e["resource"] == "send_notification" and e["outcome"] == "allowed" for e in events)
