"""Thin repository layer.

Persistence is best-effort in Foundation v0.1: if the database is unavailable the
product loop still runs, and the API logs a warning instead of failing a user
request. Writes are small and isolated here so they can be swapped for richer
repositories later without touching agents or routes.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.models import (
    ApprovalRequest,
    AuditLog,
    Conversation,
    FileRecord,
    JobApplication,
    Memory,
    Message,
    ModelUsage,
    Notification,
    ProjectWorkItem,
    RuntimeSetting,
    ScrapingJob,
    ScrapingResult,
    Task,
    TaskEvent,
    TaskStep,
    User,
    Workflow,
    WorkflowRun,
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


async def delete_conversation(conversation_id: str, user_id: str = DEMO_USER_ID) -> bool:
    try:
        async with SessionLocal() as session:
            conversation = await session.get(Conversation, conversation_id)
            if not conversation or conversation.user_id != user_id:
                return False
            await session.delete(conversation)
            await session.commit()
            return True
    except Exception as exc:
        logger.warning("conversation delete failed: %s", exc)
        return False


async def clear_conversations(user_id: str = DEMO_USER_ID) -> int:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.user_id == user_id)
            )
            rows = list(result.scalars())
            for row in rows:
                await session.delete(row)
            await session.commit()
            return len(rows)
    except Exception as exc:
        logger.warning("conversation clear failed: %s", exc)
        return 0


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


async def get_task_statuses(
    task_ids: set[str], user_id: str = DEMO_USER_ID
) -> dict[str, str]:
    if not task_ids:
        return {}
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Task.id, Task.status).where(
                    Task.id.in_(task_ids), Task.user_id == user_id
                )
            )
            return {task_id: status for task_id, status in result.all()}
    except Exception as exc:
        logger.warning("linked task status lookup failed: %s", exc)
        return {}


async def list_tasks(
    user_id: str = DEMO_USER_ID,
    limit: int = 20,
    *,
    status: str | None = None,
    query: str | None = None,
    offset: int = 0,
) -> list[Task]:
    try:
        async with SessionLocal() as session:
            statement = select(Task).where(Task.user_id == user_id)
            if status and status != "all":
                statement = statement.where(Task.status == status)
            if query:
                needle = f"%{query.strip().lower()}%"
                statement = statement.where(
                    func.lower(Task.title).like(needle)
                    | func.lower(Task.prompt).like(needle)
                    | func.lower(func.coalesce(Task.agent, "")).like(needle)
                )
            result = await session.execute(
                statement.options(selectinload(Task.steps))
                .order_by(Task.created_at.desc())
                .offset(max(0, offset))
                .limit(limit)
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("task list failed: %s", exc)
        return []


async def count_tasks(
    user_id: str = DEMO_USER_ID,
    *,
    status: str | None = None,
    query: str | None = None,
) -> int:
    try:
        async with SessionLocal() as session:
            statement = select(func.count(Task.id)).where(Task.user_id == user_id)
            if status and status != "all":
                statement = statement.where(Task.status == status)
            if query:
                needle = f"%{query.strip().lower()}%"
                statement = statement.where(
                    func.lower(Task.title).like(needle)
                    | func.lower(Task.prompt).like(needle)
                    | func.lower(func.coalesce(Task.agent, "")).like(needle)
                )
            result = await session.execute(statement)
            return int(result.scalar_one() or 0)
    except Exception:
        return 0


async def create_project_work_item(
    *,
    title: str,
    description: str = "",
    status: str = "backlog",
    priority: str = "normal",
    scheduled_for: str | None = None,
    due_date: str | None = None,
    estimate_minutes: int | None = None,
    labels: list[str] | None = None,
    user_id: str = DEMO_USER_ID,
) -> ProjectWorkItem | None:
    try:
        async with SessionLocal() as session:
            item = ProjectWorkItem(
                user_id=user_id,
                title=title.strip()[:240],
                description=description.strip(),
                status=status,
                priority=priority,
                scheduled_for=scheduled_for,
                due_date=due_date,
                estimate_minutes=estimate_minutes,
                labels=labels or [],
            )
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item
    except Exception as exc:
        logger.warning("project work item create failed: %s", exc)
        return None


async def get_project_work_item(
    item_id: str, user_id: str = DEMO_USER_ID
) -> ProjectWorkItem | None:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(ProjectWorkItem).where(
                    ProjectWorkItem.id == item_id,
                    ProjectWorkItem.user_id == user_id,
                )
            )
            return result.scalar_one_or_none()
    except Exception as exc:
        logger.warning("project work item lookup failed: %s", exc)
        return None


async def list_project_work_items(
    *,
    user_id: str = DEMO_USER_ID,
    query: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[ProjectWorkItem]:
    try:
        async with SessionLocal() as session:
            statement = select(ProjectWorkItem).where(ProjectWorkItem.user_id == user_id)
            if query and query.strip():
                needle = f"%{query.strip().lower()}%"
                statement = statement.where(
                    func.lower(ProjectWorkItem.title).like(needle)
                    | func.lower(ProjectWorkItem.description).like(needle)
                    | func.lower(ProjectWorkItem.key).like(needle)
                )
            result = await session.execute(
                statement.order_by(
                    ProjectWorkItem.scheduled_for.is_(None),
                    ProjectWorkItem.scheduled_for.asc(),
                    ProjectWorkItem.updated_at.desc(),
                )
                .offset(max(0, offset))
                .limit(max(1, min(limit, 500)))
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("project work item list failed: %s", exc)
        return []


async def count_project_work_items(
    *, user_id: str = DEMO_USER_ID, query: str | None = None
) -> int:
    try:
        async with SessionLocal() as session:
            statement = select(func.count(ProjectWorkItem.id)).where(
                ProjectWorkItem.user_id == user_id
            )
            if query and query.strip():
                needle = f"%{query.strip().lower()}%"
                statement = statement.where(
                    func.lower(ProjectWorkItem.title).like(needle)
                    | func.lower(ProjectWorkItem.description).like(needle)
                    | func.lower(ProjectWorkItem.key).like(needle)
                )
            result = await session.execute(statement)
            return int(result.scalar_one() or 0)
    except Exception as exc:
        logger.warning("project work item count failed: %s", exc)
        return 0


async def update_project_work_item(
    item_id: str,
    *,
    fields: dict[str, Any],
    user_id: str = DEMO_USER_ID,
) -> ProjectWorkItem | None:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(ProjectWorkItem).where(
                    ProjectWorkItem.id == item_id,
                    ProjectWorkItem.user_id == user_id,
                )
            )
            item = result.scalar_one_or_none()
            if not item:
                return None
            for key, value in fields.items():
                if key in {
                    "title",
                    "description",
                    "status",
                    "priority",
                    "scheduled_for",
                    "due_date",
                    "estimate_minutes",
                    "labels",
                }:
                    setattr(item, key, value)
            if item.status == "done" and item.completed_at is None:
                item.completed_at = datetime.now(UTC)
            elif item.status != "done":
                item.completed_at = None
            await session.commit()
            await session.refresh(item)
            return item
    except Exception as exc:
        logger.warning("project work item update failed: %s", exc)
        return None


async def attach_execution_to_project_work_item(
    item_id: str,
    execution_task_id: str,
    *,
    user_id: str = DEMO_USER_ID,
) -> bool:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(ProjectWorkItem).where(
                    ProjectWorkItem.id == item_id,
                    ProjectWorkItem.user_id == user_id,
                )
            )
            item = result.scalar_one_or_none()
            if not item or item.status == "done":
                return False
            item.execution_task_id = execution_task_id
            item.status = "in_progress"
            await session.commit()
            return True
    except Exception as exc:
        logger.warning("project work item execution link failed: %s", exc)
        return False


async def delete_project_work_item(
    item_id: str, user_id: str = DEMO_USER_ID
) -> bool:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(ProjectWorkItem).where(
                    ProjectWorkItem.id == item_id,
                    ProjectWorkItem.user_id == user_id,
                )
            )
            item = result.scalar_one_or_none()
            if not item:
                return False
            await session.delete(item)
            await session.commit()
            return True
    except Exception as exc:
        logger.warning("project work item delete failed: %s", exc)
        return False


# --- task events / monitor --------------------------------------------------


async def add_task_event(
    task_id: str | None,
    *,
    kind: str,
    message: str,
    level: str = "info",
    detail: str | None = None,
    step_index: int | None = None,
    data: dict[str, Any] | None = None,
) -> str | None:
    if not task_id:
        return None
    try:
        async with SessionLocal() as session:
            event = TaskEvent(
                task_id=task_id,
                kind=kind,
                level=level,
                message=message,
                detail=detail,
                step_index=step_index,
                data=data or {},
            )
            session.add(event)
            await session.commit()
            await session.refresh(event)
            return event.id
    except Exception as exc:
        logger.warning("task event write failed: %s", exc)
        return None


async def list_task_events(task_id: str, limit: int = 500) -> list[TaskEvent]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(TaskEvent)
                .where(TaskEvent.task_id == task_id)
                .order_by(TaskEvent.created_at.asc())
                .limit(limit)
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("task event list failed: %s", exc)
        return []


async def list_recent_events(limit: int = 20) -> list[TaskEvent]:
    """Latest execution events across every task, newest first."""
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(TaskEvent).order_by(TaskEvent.created_at.desc()).limit(limit)
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("recent event list failed: %s", exc)
        return []


async def task_usage(task_id: str) -> dict[str, Any]:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(
                    func.coalesce(func.sum(ModelUsage.prompt_tokens), 0),
                    func.coalesce(func.sum(ModelUsage.completion_tokens), 0),
                    func.coalesce(func.sum(ModelUsage.cost_usd), 0.0),
                    func.count(ModelUsage.id),
                ).where(ModelUsage.task_id == task_id)
            )
            prompt, completion, cost, requests = result.one()
            return {
                "requests": int(requests or 0),
                "prompt_tokens": int(prompt or 0),
                "completion_tokens": int(completion or 0),
                "total_tokens": int(prompt or 0) + int(completion or 0),
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


def _duration(task: Task) -> float | None:
    if not task.started_at or not task.finished_at:
        return None
    try:
        return max(0.0, (task.finished_at - task.started_at).total_seconds())
    except TypeError:
        return None


async def task_stats(user_id: str = DEMO_USER_ID) -> dict[str, Any]:
    """Aggregate counters for the Agent Monitor header.

    Computed from real task rows, not synthetic dashboard numbers. Only the
    most recent 500 tasks are scanned so the endpoint stays cheap on SQLite.
    """
    tasks = await list_tasks(user_id=user_id, limit=500)
    counts: dict[str, int] = {}
    for task in tasks:
        counts[task.status] = counts.get(task.status, 0) + 1

    durations = [
        duration
        for task in tasks
        if task.status == "completed"
        for duration in [_duration(task)]
        if duration is not None
    ]
    active_agents: dict[str, int] = {}
    for task in tasks:
        if task.status in {"running", "paused"}:
            key = task.agent or "core"
            active_agents[key] = active_agents.get(key, 0) + 1

    today = datetime.now(UTC).date()
    completed_today = 0
    failed_today = 0
    for task in tasks:
        when = task.finished_at or task.created_at
        if when is None:
            continue
        try:
            if when.date() != today:
                continue
        except AttributeError:
            continue
        if task.status == "completed":
            completed_today += 1
        elif task.status == "failed":
            failed_today += 1

    return {
        "counts": {
            "all": len(tasks),
            "active": counts.get("running", 0) + counts.get("paused", 0),
            "running": counts.get("running", 0),
            "paused": counts.get("paused", 0),
            "queued": counts.get("queued", 0),
            "completed": counts.get("completed", 0),
            "failed": counts.get("failed", 0),
            "cancelled": counts.get("cancelled", 0),
            "completed_today": completed_today,
            "failed_today": failed_today,
        },
        "average_duration_seconds": (
            round(sum(durations) / len(durations), 1) if durations else None
        ),
        "active_agents": [
            {"agent": slug, "running": running}
            for slug, running in sorted(active_agents.items())
        ],
        "generated_at": datetime.now(UTC).isoformat(),
    }


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


async def usage_timeseries(
    user_id: str = DEMO_USER_ID, days: int = 14
) -> list[dict[str, Any]]:
    """Daily usage buckets. Empty days are omitted, never filled with zeros."""
    try:
        async with SessionLocal() as session:
            day = func.date(ModelUsage.created_at)
            result = await session.execute(
                select(
                    day.label("day"),
                    func.count(ModelUsage.id),
                    func.coalesce(func.sum(ModelUsage.prompt_tokens), 0),
                    func.coalesce(func.sum(ModelUsage.completion_tokens), 0),
                    func.coalesce(func.sum(ModelUsage.cost_usd), 0.0),
                )
                .where(ModelUsage.user_id == user_id)
                .group_by(day)
                .order_by(day.asc())
            )
            rows = list(result.all())[-max(1, days) :]
            return [
                {
                    "date": str(row[0]),
                    "requests": int(row[1] or 0),
                    "prompt_tokens": int(row[2] or 0),
                    "completion_tokens": int(row[3] or 0),
                    "total_tokens": int(row[2] or 0) + int(row[3] or 0),
                    "cost_usd": round(float(row[4] or 0.0), 6),
                }
                for row in rows
            ]
    except Exception as exc:
        logger.warning("usage timeseries failed: %s", exc)
        return []


async def usage_breakdown(user_id: str = DEMO_USER_ID) -> dict[str, Any]:
    """Requests and tokens grouped by provider and by model."""
    try:
        async with SessionLocal() as session:

            async def grouped(column):
                result = await session.execute(
                    select(
                        column,
                        func.count(ModelUsage.id),
                        func.coalesce(
                            func.sum(ModelUsage.prompt_tokens + ModelUsage.completion_tokens),
                            0,
                        ),
                        func.coalesce(func.sum(ModelUsage.cost_usd), 0.0),
                    )
                    .where(ModelUsage.user_id == user_id)
                    .group_by(column)
                    .order_by(func.count(ModelUsage.id).desc())
                )
                return [
                    {
                        "name": str(row[0]),
                        "requests": int(row[1] or 0),
                        "tokens": int(row[2] or 0),
                        "cost_usd": round(float(row[3] or 0.0), 6),
                    }
                    for row in result.all()
                ]

            return {
                "providers": await grouped(ModelUsage.provider),
                "models": await grouped(ModelUsage.model),
            }
    except Exception as exc:
        logger.warning("usage breakdown failed: %s", exc)
        return {"providers": [], "models": []}


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


# --- workflows / automations ------------------------------------------------

WORKFLOW_STATUSES = {"draft", "active", "paused", "archived"}


def _workflow_defaults(trigger: dict[str, Any] | None, definition: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, Any]]:
    trig = trigger or {"type": "manual", "config": {}}
    if "type" not in trig:
        trig = {"type": "manual", **trig}
    defn = definition or {"nodes": [], "edges": [], "version": 1}
    defn.setdefault("nodes", [])
    defn.setdefault("edges", [])
    defn.setdefault("version", 1)
    return trig, defn


async def create_workflow(
    *,
    name: str,
    description: str | None = None,
    trigger: dict[str, Any] | None = None,
    definition: dict[str, Any] | None = None,
    enabled: bool = True,
    status: str = "draft",
    user_id: str = DEMO_USER_ID,
) -> Workflow | None:
    try:
        trig, defn = _workflow_defaults(trigger, definition)
        async with SessionLocal() as session:
            workflow = Workflow(
                user_id=user_id,
                name=name.strip()[:160] or "Untitled workflow",
                description=(description or "").strip() or None,
                trigger=trig,
                definition=defn,
                enabled=enabled,
                status=status if status in WORKFLOW_STATUSES else "draft",
            )
            session.add(workflow)
            await session.commit()
            await session.refresh(workflow)
            return workflow
    except Exception as exc:
        logger.warning("workflow create failed: %s", exc)
        return None


async def get_workflow(workflow_id: str, user_id: str = DEMO_USER_ID) -> Workflow | None:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
            )
            return result.scalar_one_or_none()
    except Exception as exc:
        logger.warning("workflow lookup failed: %s", exc)
        return None


async def list_workflows(
    *,
    user_id: str = DEMO_USER_ID,
    query: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Workflow]:
    try:
        async with SessionLocal() as session:
            statement = select(Workflow).where(Workflow.user_id == user_id)
            if query and query.strip():
                needle = f"%{query.strip().lower()}%"
                statement = statement.where(
                    func.lower(Workflow.name).like(needle)
                    | func.lower(func.coalesce(Workflow.description, "")).like(needle)
                )
            result = await session.execute(
                statement.order_by(Workflow.updated_at.desc())
                .offset(max(0, offset))
                .limit(max(1, min(limit, 200)))
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("workflow list failed: %s", exc)
        return []


async def count_workflows(*, user_id: str = DEMO_USER_ID, query: str | None = None) -> int:
    try:
        async with SessionLocal() as session:
            statement = select(func.count(Workflow.id)).where(Workflow.user_id == user_id)
            if query and query.strip():
                needle = f"%{query.strip().lower()}%"
                statement = statement.where(
                    func.lower(Workflow.name).like(needle)
                    | func.lower(func.coalesce(Workflow.description, "")).like(needle)
                )
            result = await session.execute(statement)
            return int(result.scalar_one() or 0)
    except Exception:
        return 0


async def update_workflow(
    workflow_id: str,
    *,
    fields: dict[str, Any],
    user_id: str = DEMO_USER_ID,
) -> Workflow | None:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
            )
            workflow = result.scalar_one_or_none()
            if not workflow:
                return None
            allowed = {"name", "description", "trigger", "definition", "enabled", "status"}
            for key, value in fields.items():
                if key not in allowed:
                    continue
                if key == "name" and isinstance(value, str):
                    value = value.strip()[:160] or workflow.name
                if key == "description" and isinstance(value, str):
                    value = value.strip() or None
                if key == "status" and value not in WORKFLOW_STATUSES:
                    continue
                if key in {"trigger", "definition"} and value is not None:
                    trig, defn = _workflow_defaults(
                        value if key == "trigger" else workflow.trigger,
                        value if key == "definition" else workflow.definition,
                    )
                    value = trig if key == "trigger" else defn
                setattr(workflow, key, value)
            await session.commit()
            await session.refresh(workflow)
            return workflow
    except Exception as exc:
        logger.warning("workflow update failed: %s", exc)
        return None


async def delete_workflow(workflow_id: str, user_id: str = DEMO_USER_ID) -> bool:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
            )
            workflow = result.scalar_one_or_none()
            if not workflow:
                return False
            await session.delete(workflow)
            await session.commit()
            return True
    except Exception as exc:
        logger.warning("workflow delete failed: %s", exc)
        return False


async def create_workflow_run(
    workflow_id: str,
    *,
    user_id: str = DEMO_USER_ID,
    triggered_by: str = "manual",
    input_data: dict[str, Any] | None = None,
    status: str = "queued",
    log: str | None = None,
) -> WorkflowRun | None:
    try:
        async with SessionLocal() as session:
            workflow = await session.get(Workflow, workflow_id)
            if not workflow or workflow.user_id != user_id:
                return None
            run = WorkflowRun(
                workflow_id=workflow_id,
                user_id=user_id,
                status=status,
                triggered_by=triggered_by,
                input=input_data or {},
                output={},
                log=log,
            )
            session.add(run)
            workflow.run_count = int(workflow.run_count or 0) + 1
            workflow.last_run_at = datetime.now(UTC)
            await session.commit()
            await session.refresh(run)
            return run
    except Exception as exc:
        logger.warning("workflow run create failed: %s", exc)
        return None


async def list_workflow_runs(
    workflow_id: str,
    *,
    user_id: str = DEMO_USER_ID,
    limit: int = 30,
) -> list[WorkflowRun]:
    try:
        async with SessionLocal() as session:
            workflow = await session.get(Workflow, workflow_id)
            if not workflow or workflow.user_id != user_id:
                return []
            result = await session.execute(
                select(WorkflowRun)
                .where(WorkflowRun.workflow_id == workflow_id, WorkflowRun.user_id == user_id)
                .order_by(WorkflowRun.created_at.desc())
                .limit(max(1, min(limit, 100)))
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("workflow run list failed: %s", exc)
        return []


async def get_workflow_run(run_id: str) -> WorkflowRun | None:
    try:
        async with SessionLocal() as session:
            return await session.get(WorkflowRun, run_id)
    except Exception as exc:
        logger.warning("workflow run lookup failed: %s", exc)
        return None


async def get_workflow_by_id(workflow_id: str) -> Workflow | None:
    try:
        async with SessionLocal() as session:
            return await session.get(Workflow, workflow_id)
    except Exception as exc:
        logger.warning("workflow lookup failed: %s", exc)
        return None


async def claim_next_queued_workflow_run() -> str | None:
    """Atomically move the oldest queued run to `running` and return its id."""
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(WorkflowRun.id)
                .where(WorkflowRun.status == "queued")
                .order_by(WorkflowRun.created_at.asc())
                .limit(1)
            )
            run_id = result.scalar_one_or_none()
            if not run_id:
                return None
            claimed = await session.execute(
                update(WorkflowRun)
                .where(WorkflowRun.id == run_id, WorkflowRun.status == "queued")
                .values(status="running", started_at=datetime.now(UTC))
            )
            await session.commit()
            return run_id if claimed.rowcount == 1 else None
    except Exception as exc:
        logger.warning("workflow run claim failed: %s", exc)
        return None


async def update_workflow_run(run_id: str, **fields: Any) -> None:
    try:
        async with SessionLocal() as session:
            run = await session.get(WorkflowRun, run_id)
            if not run:
                return
            for key, value in fields.items():
                if hasattr(run, key):
                    setattr(run, key, value)
            await session.commit()
    except Exception as exc:
        logger.warning("workflow run update failed: %s", exc)


async def reconcile_interrupted_workflow_runs() -> int:
    """Runs left `running` by a previous process cannot resume; mark them failed."""
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(WorkflowRun).where(WorkflowRun.status == "running")
            )
            rows = list(result.scalars())
            for run in rows:
                run.status = "failed"
                run.error = "Interrupted: the API restarted while this run was executing."
                run.finished_at = datetime.now(UTC)
            await session.commit()
            return len(rows)
    except Exception as exc:
        logger.warning("workflow run reconcile failed: %s", exc)
        return 0


async def record_audit(
    action: str,
    *,
    resource: str | None = None,
    outcome: str = "ok",
    detail: dict[str, Any] | None = None,
    user_id: str = DEMO_USER_ID,
) -> None:
    try:
        async with SessionLocal() as session:
            session.add(
                AuditLog(
                    user_id=user_id,
                    action=action[:120],
                    resource=resource,
                    outcome=outcome,
                    detail=detail or {},
                )
            )
            await session.commit()
    except Exception as exc:
        logger.warning("audit write failed: %s", exc)


# --- safety: approvals, runtime settings, notifications ---------------------


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def create_approval(
    *,
    action: str,
    summary: str,
    payload: dict[str, Any],
    payload_hash: str,
    expires_at: datetime,
    requested_by: str | None = None,
    user_id: str = DEMO_USER_ID,
) -> ApprovalRequest | None:
    try:
        async with SessionLocal() as session:
            row = ApprovalRequest(
                user_id=user_id,
                action=action,
                summary=summary[:2000],
                payload=payload,
                payload_hash=payload_hash,
                status="pending",
                requested_by=requested_by,
                expires_at=expires_at,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return row
    except Exception as exc:
        logger.warning("approval create failed: %s", exc)
        return None


async def expire_stale_approvals(user_id: str = DEMO_USER_ID) -> int:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(ApprovalRequest).where(
                    ApprovalRequest.user_id == user_id,
                    ApprovalRequest.status == "pending",
                )
            )
            now = datetime.now(UTC)
            count = 0
            for row in result.scalars():
                if _aware(row.expires_at) <= now:
                    row.status = "expired"
                    count += 1
            await session.commit()
            return count
    except Exception as exc:
        logger.warning("approval expiry failed: %s", exc)
        return 0


async def list_approvals(
    *, user_id: str = DEMO_USER_ID, status: str | None = None, limit: int = 100
) -> list[ApprovalRequest]:
    try:
        async with SessionLocal() as session:
            statement = select(ApprovalRequest).where(ApprovalRequest.user_id == user_id)
            if status and status != "all":
                statement = statement.where(ApprovalRequest.status == status)
            result = await session.execute(
                statement.order_by(ApprovalRequest.created_at.desc()).limit(max(1, min(limit, 500)))
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("approval list failed: %s", exc)
        return []


async def get_approval(approval_id: str, user_id: str = DEMO_USER_ID) -> ApprovalRequest | None:
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(ApprovalRequest).where(
                    ApprovalRequest.id == approval_id, ApprovalRequest.user_id == user_id
                )
            )
            return result.scalar_one_or_none()
    except Exception as exc:
        logger.warning("approval lookup failed: %s", exc)
        return None


async def decide_approval(
    approval_id: str,
    *,
    approved: bool,
    payload_hash: str,
    note: str | None = None,
    user_id: str = DEMO_USER_ID,
) -> tuple[ApprovalRequest | None, str]:
    """Record a decision. Returns (row, reason). The hash must match the stored payload."""
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                select(ApprovalRequest).where(
                    ApprovalRequest.id == approval_id, ApprovalRequest.user_id == user_id
                )
            )
            row = result.scalar_one_or_none()
            if row is None:
                return None, "not_found"
            if row.payload_hash != payload_hash:
                return row, "hash_mismatch"
            if row.status != "pending":
                return row, f"already_{row.status}"
            if _aware(row.expires_at) <= datetime.now(UTC):
                row.status = "expired"
                await session.commit()
                return row, "expired"
            row.status = "approved" if approved else "rejected"
            row.decided_at = datetime.now(UTC)
            row.decision_note = (note or "")[:2000] or None
            await session.commit()
            await session.refresh(row)
            return row, "ok"
    except Exception as exc:
        logger.warning("approval decision failed: %s", exc)
        return None, "error"


async def consume_approval(
    approval_id: str,
    *,
    action: str,
    payload_hash: str,
    user_id: str = DEMO_USER_ID,
) -> str:
    """Atomically spend an approval for exactly one execution. Returns "ok" or a denial reason."""
    try:
        async with SessionLocal() as session:
            result = await session.execute(
                update(ApprovalRequest)
                .where(
                    ApprovalRequest.id == approval_id,
                    ApprovalRequest.user_id == user_id,
                    ApprovalRequest.status == "approved",
                    ApprovalRequest.action == action,
                    ApprovalRequest.payload_hash == payload_hash,
                    ApprovalRequest.expires_at > datetime.now(UTC),
                )
                .values(status="consumed", consumed_at=datetime.now(UTC))
            )
            await session.commit()
            if result.rowcount == 1:
                return "ok"
            row = await session.get(ApprovalRequest, approval_id)
            if row is None:
                return "not_found"
            if row.status == "consumed":
                return "already_consumed"
            if row.status != "approved":
                return f"not_approved:{row.status}"
            if row.action != action:
                return "action_mismatch"
            if row.payload_hash != payload_hash:
                return "payload_mismatch"
            return "expired"
    except Exception as exc:
        logger.warning("approval consume failed: %s", exc)
        return "error"


async def get_runtime_setting(key: str, default: dict[str, Any]) -> dict[str, Any]:
    try:
        async with SessionLocal() as session:
            row = await session.get(RuntimeSetting, key)
            return dict(row.value) if row else dict(default)
    except Exception as exc:
        logger.warning("runtime setting read failed: %s", exc)
        return dict(default)


async def set_runtime_setting(key: str, value: dict[str, Any]) -> None:
    async with SessionLocal() as session:
        row = await session.get(RuntimeSetting, key)
        if row is None:
            session.add(RuntimeSetting(key=key, value=value))
        else:
            row.value = value
            row.updated_at = datetime.now(UTC)
        await session.commit()


async def list_audit(
    *,
    user_id: str = DEMO_USER_ID,
    action: str | None = None,
    outcome: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[AuditLog], int]:
    try:
        async with SessionLocal() as session:
            statement = select(AuditLog).where(AuditLog.user_id == user_id)
            count_statement = select(func.count(AuditLog.id)).where(AuditLog.user_id == user_id)
            if action:
                statement = statement.where(AuditLog.action.like(f"%{action}%"))
                count_statement = count_statement.where(AuditLog.action.like(f"%{action}%"))
            if outcome and outcome != "all":
                statement = statement.where(AuditLog.outcome == outcome)
                count_statement = count_statement.where(AuditLog.outcome == outcome)
            total = int((await session.execute(count_statement)).scalar_one() or 0)
            result = await session.execute(
                statement.order_by(AuditLog.created_at.desc())
                .offset(max(0, offset))
                .limit(max(1, min(limit, 500)))
            )
            return list(result.scalars()), total
    except Exception as exc:
        logger.warning("audit list failed: %s", exc)
        return [], 0


async def create_notification(
    *, title: str, body: str | None = None, kind: str = "info", user_id: str = DEMO_USER_ID
) -> str | None:
    try:
        async with SessionLocal() as session:
            row = Notification(user_id=user_id, title=title[:200], body=body, kind=kind)
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return row.id
    except Exception as exc:
        logger.warning("notification write failed: %s", exc)
        return None


async def list_notifications(
    *, user_id: str = DEMO_USER_ID, unread_only: bool = False, limit: int = 100
) -> list[Notification]:
    try:
        async with SessionLocal() as session:
            statement = select(Notification).where(Notification.user_id == user_id)
            if unread_only:
                statement = statement.where(Notification.read.is_(False))
            result = await session.execute(
                statement.order_by(Notification.created_at.desc()).limit(max(1, min(limit, 500)))
            )
            return list(result.scalars())
    except Exception as exc:
        logger.warning("notification list failed: %s", exc)
        return []


async def mark_notifications_read(
    *, notification_id: str | None = None, user_id: str = DEMO_USER_ID
) -> int:
    try:
        async with SessionLocal() as session:
            statement = update(Notification).where(
                Notification.user_id == user_id, Notification.read.is_(False)
            )
            if notification_id:
                statement = statement.where(Notification.id == notification_id)
            result = await session.execute(statement.values(read=True))
            await session.commit()
            return int(result.rowcount or 0)
    except Exception as exc:
        logger.warning("notification update failed: %s", exc)
        return 0
