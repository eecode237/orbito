"""Database engine, session factory and schema bootstrap."""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy import event
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
        return {"connect_args": {"check_same_thread": False, "timeout": 30}}
    return {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20}


engine = create_async_engine(settings.database_url, echo=False, **_engine_kwargs())

if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def _ensure_sqlite_columns(sync_conn) -> None:
    """Best-effort additive migrations for dev SQLite (create_all doesn't ALTER)."""
    try:
        rows = sync_conn.exec_driver_sql("PRAGMA table_info(workflows)").fetchall()
        if rows:
            cols = {r[1] for r in rows}
            alters = {
                "status": "ALTER TABLE workflows ADD COLUMN status VARCHAR(24) DEFAULT 'draft'",
                "run_count": "ALTER TABLE workflows ADD COLUMN run_count INTEGER DEFAULT 0",
                "last_run_at": "ALTER TABLE workflows ADD COLUMN last_run_at DATETIME",
            }
            for col, sql in alters.items():
                if col not in cols:
                    sync_conn.exec_driver_sql(sql)
        rows = sync_conn.exec_driver_sql("PRAGMA table_info(workflow_runs)").fetchall()
        if rows:
            cols = {r[1] for r in rows}
            alters = {
                "user_id": "ALTER TABLE workflow_runs ADD COLUMN user_id VARCHAR(36) DEFAULT '00000000-0000-4000-8000-000000000001'",
                "triggered_by": "ALTER TABLE workflow_runs ADD COLUMN triggered_by VARCHAR(40) DEFAULT 'manual'",
                "input": "ALTER TABLE workflow_runs ADD COLUMN input JSON DEFAULT '{}'",
                "output": "ALTER TABLE workflow_runs ADD COLUMN output JSON DEFAULT '{}'",
                "error": "ALTER TABLE workflow_runs ADD COLUMN error TEXT",
                "created_at": "ALTER TABLE workflow_runs ADD COLUMN created_at DATETIME",
            }
            for col, sql in alters.items():
                if col not in cols:
                    sync_conn.exec_driver_sql(sql)
    except Exception as exc:
        logger.warning("sqlite column migration skipped: %s", exc)


async def init_db() -> None:
    """Create tables for the current schema (Alembic takes over pre-1.0)."""
    from app.db import models  # noqa: F401  (register metadata)

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            if settings.database_url.startswith("sqlite"):
                await conn.run_sync(_ensure_sqlite_columns)
        logger.info("database ready (%s)", engine.url.get_backend_name())
    except Exception as exc:  # pragma: no cover - startup resilience
        logger.warning("database unavailable, running without persistence: %s", exc)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
