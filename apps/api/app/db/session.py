"""Database engine, session factory and schema bootstrap."""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import API_DIR, settings
from app.logging import get_logger

logger = get_logger(__name__)


class Base(DeclarativeBase):
    pass


def _engine_kwargs() -> dict:
    if settings.database_url.startswith("sqlite"):
        # Ensure the parent directory exists before SQLite tries to open it.
        raw = settings.database_url.split("///", 1)[-1]
        if raw and raw != ":memory:":
            path = Path(raw)
            if not path.is_absolute():
                path = API_DIR / path
            path.parent.mkdir(parents=True, exist_ok=True)
        return {"connect_args": {"check_same_thread": False}}
    return {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20}


engine = create_async_engine(settings.database_url, echo=False, **_engine_kwargs())
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    """Create tables for the current schema (Alembic takes over pre-1.0)."""
    from app.db import models  # noqa: F401  (register metadata)

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("database ready (%s)", engine.url.get_backend_name())
    except Exception as exc:  # pragma: no cover - startup resilience
        logger.warning("database unavailable, running without persistence: %s", exc)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
