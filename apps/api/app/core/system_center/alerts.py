"""Alert acknowledgement on top of the pure threshold evaluator.

The actual thresholds live in :mod:`app.core.system_monitor` so the legacy
dashboard, the toaster and the System Center all agree.  This module only adds
the small amount of state the API needs: which alert ids a human acknowledged.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.system_center.collector import collector
from app.core.system_monitor import build_alerts

_ACKNOWLEDGED: dict[str, str] = {}


def _decorate(alert: dict[str, Any]) -> dict[str, Any]:
    acknowledged_at = _ACKNOWLEDGED.get(alert["id"])
    return {
        **alert,
        "acknowledged": acknowledged_at is not None,
        "acknowledged_at": acknowledged_at,
    }


async def list_alerts() -> dict[str, Any]:
    snapshot = await collector.snapshot()
    alerts = [_decorate(alert) for alert in build_alerts(snapshot)]
    return {
        "alerts": alerts,
        "generated_at": snapshot["timestamp"],
        "active": len(alerts),
    }


def acknowledge(alert_id: str, acknowledged: bool = True) -> dict[str, Any]:
    if acknowledged:
        _ACKNOWLEDGED[alert_id] = datetime.now(UTC).isoformat()
    else:
        _ACKNOWLEDGED.pop(alert_id, None)
    return {
        "id": alert_id,
        "acknowledged": acknowledged,
        "acknowledged_at": _ACKNOWLEDGED.get(alert_id),
    }
