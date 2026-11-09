"""Safety spine: final execution gate, one-time approvals, kill switch, audit."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.core.safety import ActionDenied, authorize, payload_hash, request_approval
from app.main import app


def _request(client: TestClient, action: str, payload: dict, summary: str = "Test request") -> dict:
    return client.portal.call(
        lambda: request_approval(action=action, payload=payload, summary=summary, requested_by="test")
    )


def _decide(client: TestClient, approval_id: str, approved: bool, digest: str):
    return client.post(
        f"/api/v1/approvals/{approval_id}/decision",
        json={"approved": approved, "payload_hash": digest},
    )


def _authorize(client: TestClient, action: str, payload: dict, approval_id: str | None = None):
    return client.portal.call(lambda: authorize(action, payload, approval_id=approval_id))


def _kill(client: TestClient, engaged: bool):
    return client.post("/api/v1/safety/kill-switch", json={"engaged": engaged})


def test_unknown_action_is_denied_and_audited():
    with TestClient(app) as client:
        with pytest.raises(ActionDenied) as info:
            _authorize(client, "rm_everything", {})
        assert info.value.reason == "unknown_action"


def test_restricted_action_is_denied_even_with_approval():
    with TestClient(app) as client:
        row = _request(client, "execute_shell", {"cmd": "echo hi"})
        assert row is not None
        _decide(client, row.id, True, row.payload_hash)
        with pytest.raises(ActionDenied) as info:
            _authorize(client, "execute_shell", {"cmd": "echo hi"}, approval_id=row.id)
        assert info.value.reason == "sandbox_not_enabled"


def test_approval_action_requires_an_approval_id():
    with TestClient(app) as client:
        with pytest.raises(ActionDenied) as info:
            _authorize(client, "write_file", {"path": "notes.txt"})
        assert info.value.reason == "approval_required"


def test_approval_is_bound_to_the_exact_payload():
    with TestClient(app) as client:
        payload = {"path": "notes.txt", "bytes": 12}
        row = _request(client, "write_file", payload)
        assert row.payload_hash == payload_hash("write_file", payload)
        _decide(client, row.id, True, row.payload_hash)
        with pytest.raises(ActionDenied) as info:
            _authorize(client, "write_file", {"path": "other.txt", "bytes": 12}, approval_id=row.id)
        assert info.value.reason == "payload_mismatch"


def test_approval_is_one_time_use():
    with TestClient(app) as client:
        payload = {"path": "once.txt"}
        row = _request(client, "write_file", payload)
        assert _decide(client, row.id, True, row.payload_hash).status_code == 200
        _authorize(client, "write_file", payload, approval_id=row.id)
        with pytest.raises(ActionDenied) as info:
            _authorize(client, "write_file", payload, approval_id=row.id)
        assert info.value.reason == "already_consumed"


def test_rejected_approval_cannot_execute():
    with TestClient(app) as client:
        payload = {"path": "nope.txt"}
        row = _request(client, "delete_file", payload)
        assert _decide(client, row.id, False, row.payload_hash).status_code == 200
        with pytest.raises(ActionDenied) as info:
            _authorize(client, "delete_file", payload, approval_id=row.id)
        assert info.value.reason == "not_approved:rejected"


def test_decision_with_wrong_hash_is_refused_and_leaves_request_pending():
    with TestClient(app) as client:
        row = _request(client, "send_email", {"to": "a@example.com", "body": "hi"})
        response = _decide(client, row.id, True, "0" * 64)
        assert response.status_code == 409
        assert "hash_mismatch" in response.json()["error"]["message"]
        pending = client.get("/api/v1/approvals?status=pending").json()["approvals"]
        assert any(item["id"] == row.id for item in pending)


def test_kill_switch_denies_auto_actions_until_released():
    with TestClient(app) as client:
        assert _kill(client, True).status_code == 200
        try:
            with pytest.raises(ActionDenied) as info:
                _authorize(client, "search_web", {"query": "orbito"})
            assert info.value.reason == "kill_switch"
            status = client.get("/api/v1/safety/status").json()
            assert status["kill_switch"]["engaged"] is True
        finally:
            _kill(client, False)
        _authorize(client, "search_web", {"query": "orbito"})


def test_auto_action_is_allowed_and_audited():
    with TestClient(app) as client:
        _authorize(client, "read_page", {"url": "https://example.com"})
        events = client.get("/api/v1/audit?action=safety.authorize&limit=50").json()["events"]
        assert any(e["resource"] == "read_page" and e["outcome"] == "allowed" for e in events)


def test_safety_changes_are_refused_from_non_loopback(monkeypatch):
    with TestClient(app) as client:
        monkeypatch.setattr(settings, "app_env", "production")
        response = _kill(client, True)
        assert response.status_code == 403


def test_approval_api_creates_pending_request_with_notification():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/approvals",
            json={"action": "write_file", "payload": {"path": "api.txt"}, "summary": "Write api.txt"},
        )
        assert created.status_code == 201, created.text
        approval = created.json()["approval"]
        assert approval["status"] == "pending"
        assert approval["payload_hash"] == payload_hash("write_file", {"path": "api.txt"})
        unknown = client.post(
            "/api/v1/approvals", json={"action": "nuke", "payload": {}, "summary": "x"}
        )
        assert unknown.status_code == 422
        notes = client.get("/api/v1/notifications").json()["notifications"]
        assert any(n["title"] == "Approval needed: write_file" for n in notes)


def test_notifications_can_be_marked_read():
    with TestClient(app) as client:
        client.post(
            "/api/v1/approvals",
            json={"action": "delete_file", "payload": {"path": "x"}, "summary": "Delete x"},
        )
        result = client.post("/api/v1/notifications/read-all").json()
        assert result["updated"] >= 1
        assert client.get("/api/v1/notifications?unread=true").json()["notifications"] == []
