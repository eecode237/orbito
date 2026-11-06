"""Thin repository layer.

Persistence is best-effort in Foundation v0.1: if the database is unavailable the
product loop still runs, and the API logs a warning instead of failing a user
request. Writes are small and isolated here so they can be swapped for richer
repositories later without touching agents or routes.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.models import (
    Conversation,
    FileRecord,
    JobApplication,
    Memory,
    Message,
    ModelUsage,
    ScrapingJob,
    ScrapingResult,
    Task,
    TaskStep,
    User,
)
from app.db.session import SessionLocal
from app.logging import get_logger

logger = get_logger(__name__)

DEMO_USER_ID = "00000000-0000-4000-8000-000000000001"


async def ensure_demo_user() -> None:
    try:
        async with SessionLocal() as session:
            existing = await session.get(User, DEMO_USER_ID)
            if existing:
                return
            session.add(
                User(
                    id=DEMO_USER_ID,
                    email=settings.demo_user_email,
                    name="Explorer",
                    plan="pro",
                )
            )
            await session.commit()
    except Exception as exc:  # pragma: no cover
        logger.warning("could not seed demo user: %s", exc)


async def get_conversation(conversation_id: str) -> Conversation | None:
    try:
        async with SessionLocal() as session:
            return await session.get(Conversation, conversation_id)
    except Exception as exc:
        logger.warning("conversation lookup failed: %s", exc)
        return None


async def get_or_create_conversation(
    conversation_id: str | None,
    *,
    title: str | None = None,
    agent: str | None = None,
    model_role: str | None = None,
    user_id: str = DEMO_USER_ID,
) -> str | None:
    try:
        async with SessionLocal() as session:
            if conversation_id:
                existing = await session.get(Conversation, conversation_id)
                if existing:
                    return existing.id
            conversation = Conversation(
                user_id=user_id,
                title=(title or "New conversation")[:240],
                agent=agent,
                model_role=model_role,
            )
            session.add(conversation)
            await session.commit()
            await session.refresh(conversation)
            return conversation.id
    except Exception as exc:
        logger.warning("conversation write failed: %s", exc)
        return conversation_id


async def list_conversations(user_id: str = DEMO_USER_ID, limit: int = 30) -> list[Conversation]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Conversation)
                .where(Conversation.user_id == user_id, Conversation.archived.is_(False))
                .order_by(Conversation.updated_at.desc())
                .limit(limit)
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("conversation list failed: %s", exc)
        return []


async def add_message(
    *,
    conversation_id: str,
    role: str,
    content: str,
    user_id: str = DEMO_USER_ID,
    model: str | None = None,
    provider: str | None = None,
    tokens: int = 0,
    meta: dict[str, Any] | None = None,
) -> None:
    try:
        async with SessionLocal() as session:
            session.add(
                Message(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    role=role,
                    content=content,
                    model=model,
                    provider=provider,
                    tokens=tokens,
                    meta=meta or {},
                )
            )
            conversation = await session.get(Conversation, conversation_id)
            if conversation:
                conversation.updated_at = datetime.now(UTC)
                if conversation.title == "New conversation" and role == "user":
                    conversation.title = content.strip()[:80] or "New conversation"
            await session.commit()
    except Exception as exc:
        logger.warning("message write failed: %s", exc)


async def list_messages(conversation_id: str, limit: int = 100) -> list[Message]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at.asc())
                .limit(limit)
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("message list failed: %s", exc)
        return []


async def create_task(
    *,
    title: str,
    prompt: str,
    agent: str | None,
    conversation_id: str | None,
    model_role: str | None,
    user_id: str = DEMO_USER_ID,
) -> str | None:
    try:
        async with SessionLocal() as session:
            task = Task(
                user_id=user_id,
                conversation_id=conversation_id,
                agent=agent,
                title=title[:240],
                prompt=prompt,
                status="running",
                started_at=datetime.now(UTC),
                meta={"model_role": model_role},
            )
            session.add(task)
            await session.commit()
            await session.refresh(task)
            return task.id
    except Exception as exc:
        logger.warning("task create failed: %s", exc)
        return None


async def update_task(task_id: str | None, **fields: Any) -> None:
    if not task_id:
        return
    try:
        async with SessionLocal() as session:
            task = await session.get(Task, task_id)
            if not task:
                return
            for key, value in fields.items():
                if hasattr(task, key):
                    setattr(task, key, value)
            await session.commit()
    except Exception as exc:
        logger.warning("task update failed: %s", exc)


async def add_step(
    task_id: str | None,
    *,
    index: int,
    title: str,
    status: str = "pending",
    detail: str | None = None,
    tool: str | None = None,
) -> str | None:
    if not task_id:
        return None
    try:
        async with SessionLocal() as session:
            step = TaskStep(
                task_id=task_id,
                index=index,
                title=title,
                status=status,
                detail=detail,
                tool=tool,
                started_at=datetime.now(UTC) if status == "running" else None,
            )
            session.add(step)
            await session.commit()
            await session.refresh(step)
            return step.id
    except Exception as exc:
        logger.warning("step write failed: %s", exc)
        return None


async def update_step(step_id: str | None, **fields: Any) -> None:
    if not step_id:
        return
    try:
        async with SessionLocal() as session:
            step = await session.get(TaskStep, step_id)
            if not step:
                return
            for key, value in fields.items():
                if hasattr(step, key):
                    setattr(step, key, value)
            await session.commit()
    except Exception as exc:
        logger.warning("step update failed: %s", exc)


async def get_task(task_id: str) -> Task | None:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Task).where(Task.id == task_id).options(selectinload(Task.steps))
            )
            return result.scalar_one_or_none()
    except Exception as exc:
        logger.warning("task lookup failed: %s", exc)
        return None


async def list_tasks(user_id: str = DEMO_USER_ID, limit: int = 20) -> list[Task]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Task)
                .where(Task.user_id == user_id)
                .options(selectinload(Task.steps))
                .order_by(Task.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("task list failed: %s", exc)
        return []


async def record_usage(
    *,
    provider: str,
    model: str,
    capability: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd: float,
    task_id: str | None = None,
    user_id: str = DEMO_USER_ID,
) -> None:
    try:
        async with SessionLocal() as session:
            session.add(
                ModelUsage(
                    user_id=user_id,
                    task_id=task_id,
                    provider=provider,
                    model=model,
                    capability=capability,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    cost_usd=cost_usd,
                )
            )
            await session.commit()
    except Exception as exc:
        logger.warning("usage write failed: %s", exc)


async def usage_summary(user_id: str = DEMO_USER_ID) -> dict[str, Any]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(
                    func.count(ModelUsage.id),
                    func.coalesce(func.sum(ModelUsage.prompt_tokens), 0),
                    func.coalesce(func.sum(ModelUsage.completion_tokens), 0),
                    func.coalesce(func.sum(ModelUsage.cost_usd), 0.0),
                ).where(ModelUsage.user_id == user_id)
            )
            requests, prompt_tokens, completion_tokens, cost = result.one()
            return {
                "requests": int(requests or 0),
                "prompt_tokens": int(prompt_tokens or 0),
                "completion_tokens": int(completion_tokens or 0),
                "total_tokens": int(prompt_tokens or 0) + int(completion_tokens or 0),
                "cost_usd": round(float(cost or 0.0), 6),
            }
    except Exception:
        return {
            "requests": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
        }


# --- scraping ---------------------------------------------------------------


async def create_scraping_job(
    *,
    name: str,
    urls: list[str],
    schema: dict[str, Any],
    config: dict[str, Any],
    user_id: str = DEMO_USER_ID,
) -> str | None:
    try:
        async with SessionLocal() as session:
            job = ScrapingJob(
                user_id=user_id,
                name=name,
                urls=urls,
                schema_=schema,
                config=config,
                status="queued",
                pages_total=min(len(urls), settings.scraping_max_pages),
            )
            session.add(job)
            await session.commit()
            await session.refresh(job)
            return job.id
    except Exception as exc:
        logger.warning("scraping job create failed: %s", exc)
        return None


async def update_scraping_job(job_id: str, **fields: Any) -> None:
    try:
        async with SessionLocal() as session:
            job = await session.get(ScrapingJob, job_id)
            if not job:
                return
            for key, value in fields.items():
                if hasattr(job, key):
                    setattr(job, key, value)
            await session.commit()
    except Exception as exc:
        logger.warning("scraping job update failed: %s", exc)


async def add_scraping_result(job_id: str, url: str, data: dict[str, Any]) -> None:
    try:
        async with SessionLocal() as session:
            session.add(ScrapingResult(job_id=job_id, url=url, data=data))
            await session.commit()
    except Exception as exc:
        logger.warning("scraping result write failed: %s", exc)


async def get_scraping_job(job_id: str) -> ScrapingJob | None:
    try:
        async with SessionLocal() as session:
            return await session.get(ScrapingJob, job_id)
    except Exception:
        return None


async def list_scraping_jobs(user_id: str = DEMO_USER_ID, limit: int = 20) -> list[ScrapingJob]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(ScrapingJob)
                .where(ScrapingJob.user_id == user_id)
                .order_by(ScrapingJob.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars())
    except Exception:
        return []


async def list_scraping_results(job_id: str, limit: int = 500) -> list[ScrapingResult]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(ScrapingResult)
                .where(ScrapingResult.job_id == job_id)
                .order_by(ScrapingResult.created_at.asc())
                .limit(limit)
            )
            return list(result.scalars())
    except Exception:
        return []


# --- memory -----------------------------------------------------------------


async def list_memories(user_id: str = DEMO_USER_ID, limit: int = 100) -> list[Memory]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Memory)
                .where(Memory.user_id == user_id)
                .order_by(Memory.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars())
    except Exception:
        return []


async def add_memory(
    content: str,
    *,
    scope: str = "long_term",
    key: str | None = None,
    workspace_id: str | None = None,
    user_id: str = DEMO_USER_ID,
) -> str | None:
    try:
        async with SessionLocal() as session:
            memory = Memory(
                user_id=user_id,
                workspace_id=workspace_id,
                scope=scope,
                key=key,
                content=content,
                source="user",
            )
            session.add(memory)
            await session.commit()
            await session.refresh(memory)
            return memory.id
    except Exception as exc:
        logger.warning("memory write failed: %s", exc)
        return None


async def delete_memory(memory_id: str, user_id: str = DEMO_USER_ID) -> bool:
    try:
        async with SessionLocal() as session:
            memory = await session.get(Memory, memory_id)
            if not memory or memory.user_id != user_id:
                return False
            await session.delete(memory)
            await session.commit()
            return True
    except Exception:
        return False


async def list_applications(user_id: str = DEMO_USER_ID, limit: int = 50) -> list[JobApplication]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(JobApplication)
                .where(JobApplication.user_id == user_id)
                .order_by(JobApplication.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars())
    except Exception:
        return []


# --- files ------------------------------------------------------------------


async def create_file(
    *,
    name: str,
    storage_key: str,
    size: int,
    mime: str,
    user_id: str = DEMO_USER_ID,
) -> str | None:
    try:
        async with SessionLocal() as session:
            record = FileRecord(
                user_id=user_id,
                name=name,
                storage_key=storage_key,
                size=size,
                mime=mime,
            )
            session.add(record)
            await session.commit()
            await session.refresh(record)
            return record.id
    except Exception as exc:
        logger.warning("file record write failed: %s", exc)
        return None


async def list_files(user_id: str = DEMO_USER_ID, limit: int = 100) -> list[FileRecord]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(FileRecord)
                .where(FileRecord.user_id == user_id)
                .order_by(FileRecord.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars())
    except Exception:
        return []

