"""Safety spine: final execution gate, approvals, kill switch."""

from app.core.safety.gate import (
    ActionDenied,
    authorize,
    is_known_action,
    kill_switch_engaged,
    pc_control_enabled,
    payload_hash,
    request_approval,
)

__all__ = [
    "ActionDenied",
    "authorize",
    "is_known_action",
    "kill_switch_engaged",
    "pc_control_enabled",
    "payload_hash",
    "request_approval",
]

