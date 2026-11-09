"""Request-level safety checks shared by API routers."""

from __future__ import annotations

from fastapi import HTTPException, Request

from app.config import settings

LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}


def require_loopback(request: Request) -> None:
    """Refuse safety-changing requests that do not come from this machine."""
    host = request.client.host if request.client else ""
    allowed = set(LOOPBACK_HOSTS)
    if settings.app_env == "test":
        allowed.add("testclient")
    if host not in allowed:
        raise HTTPException(status_code=403, detail="Safety changes are accepted from loopback only.")

