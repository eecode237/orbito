"""Health and readiness."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.core.model_gateway import gateway
from app.db.session import engine

router = APIRouter(tags=["system"])


async def _db_status() -> str:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "unavailable"


@router.get("/health")
async def health() -> dict:
    models = gateway.provider_status()
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "env": settings.app_env,
        "database": await _db_status(),
        "providers": {model["id"]: model["configured"] for model in models},
        "live_provider": any(
            model["configured"] and model["id"] != "mock" for model in models
        ),
    }


@router.get("/system/tools")
async def system_tools() -> dict:
    from app.tools.registry import tools

    return {"tools": tools.describe()}


@router.get("/usage")
async def usage() -> dict:
    from app.db import repositories as repo

    return await repo.usage_summary()
