"""System Center API tests against real local telemetry.

The suite runs on the same Linux host as the API.  Hardware that is absent
(GPU utilization, battery, thermal zones) is expected to be returned as null
rather than faked, so the assertions only pin down the shape.
"""

from __future__ import annotations

import os
import subprocess
import sys

from fastapi.testclient import TestClient

from app.main import app


def test_overview_is_a_real_host_snapshot():
    with TestClient(app) as client:
        response = client.get("/api/v1/system/overview")
    assert response.status_code == 200, response.text
    body = response.json()
    assert 0 <= body["cpu"]["percent"] <= 100
    assert body["cpu"]["threads"] >= 1
    assert len(body["cpu"]["per_core"]) >= 1
    assert body["cpu"]["architecture"]
    assert body["memory"]["total_bytes"] > 0
    assert 0 <= body["memory"]["percent"] <= 100
    assert body["disk"]["partitions"]
    system_root = "/" if os.name != "nt" else os.path.splitdrive(sys.executable)[0] + os.sep
    assert system_root in {item["mountpoint"] for item in body["disk"]["partitions"]}
    assert isinstance(body["disk_io"]["read_bytes"], int)
    assert isinstance(body["network"]["interfaces"], list)
    assert isinstance(body["gpu"]["devices"], list)
    for device in body["gpu"]["devices"]:
        # Unsupported metrics must be explicit, never a fabricated zero.
        if device["utilization_percent"] is None:
            assert "utilization" in device["unavailable_metrics"]
    assert isinstance(body["thermal"]["sensors"], list)
    assert body["battery"] is None or "percent" in body["battery"]
    assert body["process_count"] > 0
    assert body["machine"]["label"]


def test_history_builds_from_samples():
    with TestClient(app) as client:
        response = client.get("/api/v1/system/history?range=5m&points=60")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["range"] == "5m"
    assert body["count"] >= 1
    assert body["points"][0]["timestamp"]
    assert 0 <= body["points"][0]["cpu_percent"] <= 100
    assert body["retention_seconds"] >= 24 * 60 * 60


def test_process_pagination_and_detail():
    with TestClient(app) as client:
        listing = client.get("/api/v1/system/processes?limit=5&sort=memory")
        assert listing.status_code == 200, listing.text
        body = listing.json()
        assert body["total"] > 0
        assert 1 <= len(body["processes"]) <= 5
        assert body["limit"] == 5
        first = body["processes"][0]
        assert {"pid", "name", "cpu_percent", "memory_bytes", "protected"} <= set(first)

        detail = client.get(f"/api/v1/system/processes/{first['pid']}")
        assert detail.status_code == 200, detail.text
        payload = detail.json()
        assert payload["pid"] == first["pid"]
        assert "cmdline" in payload
        assert isinstance(payload["history"], list)


def test_protected_and_missing_processes_are_refused():
    with TestClient(app) as client:
        protected = client.post("/api/v1/system/processes/1/terminate")
        missing = client.post("/api/v1/system/processes/999999/terminate")
    assert protected.status_code == 403
    assert missing.status_code == 404


def test_terminate_spawned_process():
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    try:
        with TestClient(app) as client:
            response = client.post(f"/api/v1/system/processes/{child.pid}/terminate")
        assert response.status_code == 200, response.text
        assert response.json()["terminated"] is True
        assert child.wait(timeout=5) is not None
    finally:
        if child.poll() is None:
            child.kill()


def test_alert_acknowledgement_round_trip():
    with TestClient(app) as client:
        ack = client.patch(
            "/api/v1/system/alerts/test-alert",
            json={"acknowledged": True},
        )
        assert ack.status_code == 200, ack.text
        assert ack.json()["acknowledged"] is True
        assert ack.json()["acknowledged_at"]

        clear = client.patch(
            "/api/v1/system/alerts/test-alert",
            json={"acknowledged": False},
        )
        assert clear.status_code == 200, clear.text
        assert clear.json()["acknowledged"] is False
