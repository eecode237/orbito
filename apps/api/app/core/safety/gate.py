"""Final execution gate for sensitive actions.

Every state-changing action calls `authorize()` immediately before it runs. The
gate, not the prompt or the agent, decides:

- unknown action names are denied;
- the kill switch denies everything;
- AUTO actions are allowed and audited;
- APPROVAL actions need a one-time approval bound to the exact payload hash;
- SANDBOX/RESTRICTED actions are denied (no executor exists for them yet).

Denials and allowances are written to the audit log.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.permissions.policy import Action, decision
from app.db import repositories as repo
from app.db.models import ApprovalRequest
from app.logging import get_logger

logger = get_logger(__name__)

DEFAULT_APPROVAL_TTL_SECONDS = 900


class ActionDenied(Exception):
    def __init__(self, reason: str, action: str) -> None:
        super().__init__(f"Action '{action}' denied: {reason}")
        self.reason = reason
        self.action = action


def is_known_action(action: str) -> bool:
    try:
        Action(action)
    except ValueError:
        return False
    return True


def payload_hash(action: str, payload: dict[str, Any]) -> str:
    canonical = json.dumps(
        {"action": action, "payload": payload},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def kill_switch_engaged() -> bool:
    state = await repo.get_runtime_setting("kill_switch", {"engaged": False})
    return bool(state.get("engaged"))


async def pc_control_enabled() -> bool:
    state = await repo.get_runtime_setting("pc_control", {"enabled": False})
    return bool(state.get("enabled"))


async def request_approval(
    *,
    action: str,
    payload: dict[str, Any],
    summary: str,
    requested_by: str | None = None,
    ttl_seconds: int = DEFAULT_APPROVAL_TTL_SECONDS,
) -> ApprovalRequest | None:
    if not is_known_action(action):
        raise ActionDenied("unknown_action", action)
    expires = datetime.now(UTC) + timedelta(seconds=max(60, min(ttl_seconds, 86_400)))
    row = await repo.create_approval(
        action=action,
        summary=summary,
        payload=payload,
        payload_hash=payload_hash(action, payload),
        expires_at=expires,
        requested_by=requested_by,
    )
    if row is not None:
        await repo.create_notification(
            title=f"Approval needed: {action}",
            body=summary,
            kind="approval",
        )
        await repo.record_audit(
            "approval.requested",
            resource=action,
            outcome="pending",
            detail={"approval_id": row.id, "requested_by": requested_by},
        )
    return row


async def authorize(
    action: str,
    payload: dict[str, Any],
    *,
    approval_id: str | None = None,
) -> None:
    """Raise ActionDenied unless this exact action+payload may execute now."""
    if not is_known_action(action):
        await _audit_denied(action, "unknown_action", approval_id)
        raise ActionDenied("unknown_action", action)

    if await kill_switch_engaged():
        await _audit_denied(action, "kill_switch", approval_id)
        raise ActionDenied("kill_switch", action)

    verdict = decision(Action(action))
    if verdict == "auto":
        await _audit_allowed(action, None)
        return

    if verdict == "approval":
        if not approval_id:
            await _audit_denied(action, "approval_required", None)
            raise ActionDenied("approval_required", action)
        outcome = await repo.consume_approval(
            approval_id, action=action, payload_hash=payload_hash(action, payload)
        )
        if outcome != "ok":
            await _audit_denied(action, outcome, approval_id)
            raise ActionDenied(outcome, action)
        await _audit_allowed(action, approval_id)
        return

    await _audit_denied(action, f"{verdict}_not_enabled", approval_id)
    raise ActionDenied(f"{verdict}_not_enabled", action)


async def _audit_allowed(action: str, approval_id: str | None) -> None:
    await repo.record_audit(
        "safety.authorize",
        resource=action,
        outcome="allowed",
        detail={"approval_id": approval_id},
    )


async def _audit_denied(action: str, reason: str, approval_id: str | None) -> None:
    await repo.record_audit(
        "safety.authorize",
        resource=action,
        outcome="denied",
        detail={"reason": reason, "approval_id": approval_id},
    )
