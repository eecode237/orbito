"""System monitor tests — pure threshold logic plus a real local sample."""

from __future__ import annotations

import copy

from fastapi.testclient import TestClient

from app.api.v1 import system as system_api
from app.config import settings
from app.core.system_monitor import SystemMonitor, build_alerts
from app.main import app

HEALTHY = {
    "timestamp": "2026-01-01T00:00:00+00:00",
    "cpu": {"percent": 12.0, "per_core": [10.0, 14.0], "cores": 8, "load": None},
    "memory": {
        "total_bytes": 32 * 1024**3,
        "available_bytes": 20 * 1024**3,
        "used_bytes": 12 * 1024**3,
        "percent": 37.5,
        "swap_total_bytes": 8 * 1024**3,
        "swap_used_bytes": 0,
        "swap_percent": 0.0,
    },
    "disk": {
        "path": "/home/test",
        "total_bytes": 500 * 1024**3,
        "used_bytes": 100 * 1024**3,
        "free_bytes": 400 * 1024**3,
        "percent": 20.0,
    },
    "temperature_c": 52.0,
    "battery": {"percent": 80, "status": "Discharging", "plugged": False},
    "ollama": {
        "reachable": True,
        "version": "0.40.15",
        "base_url": "http://localhost:11434",
        "error": None,
    },
}


def _with(path: str, value):
    stats = copy.deepcopy(HEALTHY)
    node = stats
    keys = path.split(".")
    for key in keys[:-1]:
        node = node[key]
    node[keys[-1]] = value
    return stats


def test_healthy_snapshot_has_no_alerts():
    assert build_alerts(HEALTHY) == []


def test_memory_escalates_from_warning_to_critical():
    warning = build_alerts(_with("memory.percent", 92.0))
    critical = build_alerts(_with("memory.percent", 98.0))

    assert [alert["id"] for alert in warning] == ["memory-high"]
    assert warning[0]["level"] == "warning"
    assert [alert["id"] for alert in critical] == ["memory-critical"]
    assert critical[0]["level"] == "critical"


def test_disk_swap_cpu_and_heat_alerts():
    stats = _with("disk.percent", 97.0)
    stats["memory"]["swap_percent"] = 85.0
    stats["cpu"]["percent"] = 99.0
    stats["temperature_c"] = 94.0

    ids = {alert["id"] for alert in build_alerts(stats)}
    assert {"disk-critical", "swap-high", "cpu-high", "temperature-critical"} <= ids


def test_battery_alert_only_when_unplugged():
    low = _with("battery.percent", 10)
    plugged = _with("battery.percent", 10)
    plugged["battery"]["plugged"] = True
    plugged["battery"]["status"] = "Charging"

    assert [alert["id"] for alert in build_alerts(low)] == ["battery-low"]
    assert build_alerts(plugged) == []


def test_ollama_offline_alert_when_local_models_enabled(monkeypatch):
    monkeypatch.setattr(settings, "ollama_enabled", True)
    stats = _with("ollama.reachable", False)
    stats["ollama"]["error"] = "Ollama is not running."

    alerts = build_alerts(stats)
    assert [alert["id"] for alert in alerts] == ["ollama-offline"]
    assert alerts[0]["href"] == "/settings?tab=hub"


def test_stats_and_alerts_endpoints_return_live_shape(monkeypatch):
    monkeypatch.setattr(
        system_api,
        "monitor",
        SystemMonitor(with_ollama=False, cache_seconds=0),
    )

    with TestClient(app) as client:
        stats = client.get("/api/v1/system/stats")
        alerts = client.get("/api/v1/system/alerts")

    assert stats.status_code == 200, stats.text
    payload = stats.json()
    assert 0 <= payload["cpu"]["percent"] <= 100
    assert payload["cpu"]["cores"] >= 1
    assert payload["memory"]["total_bytes"] > 0
    assert payload["disk"]["total_bytes"] > 0
    assert "uptime_seconds" in payload
    assert payload["ollama"]["reachable"] is False

    assert alerts.status_code == 200, alerts.text
    body = alerts.json()
    assert isinstance(body["alerts"], list)
    assert body["generated_at"]
