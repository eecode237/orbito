"""Orchestrator — the loop that turns a message into a tracked, streamed result.

Flow: route → plan → execute tools → build prompt → stream model → persist.

This is a deterministic async state machine today. It intentionally mirrors a
LangGraph `StateGraph` (nodes, transitions, checkpoints) so it can be moved onto
LangGraph in Phase 3 without changing agent or gateway contracts.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from app.agents.base import Agent, AgentPlanStep
from app.agents.registry import agents
from app.core import task_controls as controls
from app.core.memory.store import build_system_prompt, maybe_capture, recall
from app.core.model_gateway import GenerationRequest, Message as GatewayMessage
from app.core.model_gateway import gateway, registry
from app.core.task_controls import TaskCancelled
from app.db import repositories as repo
from app.logging import get_logger

logger = get_logger(__name__)

ORBITO_BASE = (
    "You are ORBITO, a multi-agent AI operating system. You are concise, practical and "
    "transparent about the steps you take. Never invent tool results."
)


@dataclass(slots=True)
class OrchestratorRequest:
    message: str
    user_id: str
    conversation_id: str | None = None
    agent_slug: str | None = None
    model_role: str | None = None
    history: list[GatewayMessage] = field(default_factory=list)
    workspace_id: str | None = None
    context: str | None = None


class Orchestrator:
    async def run(self, request: OrchestratorRequest) -> AsyncIterator[dict[str, Any]]:
        agent = agents.select(request.message, request.agent_slug)
        capability = self._capability(request.model_role or agent.model_role)
        resolved = gateway.resolve(capability)
        spec = resolved[0][0] if resolved else registry.get(capability)

        plan = self._build_plan(agent, request.message)
        task_id = await repo.create_task(
            title=self._title(request.message),
            prompt=request.message,
            agent=agent.slug,
            conversation_id=request.conversation_id,
            model_role=capability,
            user_id=request.user_id,
        )

        step_rows: list[str | None] = []
        for index, step in enumerate(plan):
            step_rows.append(
                await repo.add_step(
                    task_id, index=index, title=step.title, tool=step.tool
                )
            )

        await repo.add_task_event(
            task_id,
            kind="task.created",
            message=self._title(request.message),
            detail="ORBITO accepted the task and started planning.",
            data={"agent": agent.slug, "steps": len(plan)},
        )
        await repo.add_task_event(
            task_id,
            kind="agent.selected",
            level="agent",
            message=f"{agent.name} agent selected",
            detail=agent.tagline,
            data={"agent": agent.slug, "capabilities": agent.capabilities},
        )
        await repo.add_task_event(
            task_id,
            kind="model.selected",
            level="model",
            message=f"{spec.label} ({spec.model})",
            detail=f"Provider: {spec.provider} · role: {capability}",
            data={
                "provider": spec.provider,
                "model": spec.model,
                "role": capability,
                "local": spec.local,
            },
        )

        yield {
            "type": "task.created",
            "task_id": task_id,
            "agent": agent.describe(),
            "model_role": capability,
            "model": {
                "provider": spec.provider,
                "name": spec.model,
                "label": spec.label,
                "offline": spec.provider == "mock",
            },
            "steps": [
                {"index": i, "title": step.title, "status": "pending"}
                for i, step in enumerate(plan)
            ],
        }

        tool_context = ""
        sources: list[dict[str, Any]] = []
        try:
            for index, step in enumerate(plan):
                await controls.checkpoint(task_id)
                await self._step(step_rows[index], index, step.title, "running")
                await repo.add_task_event(
                    task_id,
                    kind="step.started",
                    message=step.title,
                    detail="Step started.",
                    step_index=index,
                    data={"tool": step.tool},
                )
                yield {
                    "type": "step.updated",
                    "index": index,
                    "title": step.title,
                    "status": "running",
                    "detail": None,
                }

                detail: str | None = None
                if step.tool:
                    await repo.add_task_event(
                        task_id,
                        kind="tool.call",
                        level="tool",
                        message=f"Calling {step.tool}",
                        step_index=index,
                        data={"tool": step.tool},
                    )
                    result = await agent.gather(request.message, {"task_id": task_id})
                    if result is not None:
                        if result.ok:
                            tool_context = result.summary
                            detail = result.summary[:240] or "Done"
                            sources.extend(dict(source) for source in result.sources)
                            await repo.add_task_event(
                                task_id,
                                kind="tool.result",
                                level="tool",
                                message=f"{step.tool} returned {len(result.sources)} source(s)",
                                detail=detail,
                                step_index=index,
                                data={
                                    "tool": step.tool,
                                    "sources": [dict(source) for source in result.sources],
                                },
                            )
                            yield {
                                "type": "sources",
                                "sources": result.sources,
                            }
                        else:
                            detail = result.error or "Tool unavailable"
                            await repo.add_task_event(
                                task_id,
                                kind="tool.error",
                                level="error",
                                message=f"{step.tool} failed",
                                detail=detail,
                                step_index=index,
                                data={"tool": step.tool},
                            )
                            yield {
                                "type": "step.updated",
                                "index": index,
                                "title": step.title,
                                "status": "failed",
                                "detail": detail,
                            }
                            await self._step(
                                step_rows[index], index, step.title, "failed", detail
                            )
                            await asyncio.sleep(0.08)
                            continue

                await self._step(step_rows[index], index, step.title, "done", detail)
                await repo.add_task_event(
                    task_id,
                    kind="step.completed",
                    level="success",
                    message=f"{step.title} completed",
                    detail=detail,
                    step_index=index,
                    data={"tool": step.tool},
                )
                await repo.update_task(
                    task_id,
                    progress=min(80, int(((index + 1) / max(1, len(plan))) * 80)),
                )
                yield {
                    "type": "step.updated",
                    "index": index,
                    "title": step.title,
                    "status": "done",
                    "detail": detail,
                }
                await asyncio.sleep(0.12)

            await controls.checkpoint(task_id)
            memory = await recall(request.user_id)
            await maybe_capture(request.user_id, request.message, request.workspace_id)

            system = build_system_prompt(
                ORBITO_BASE,
                agent_prompt=agent.system_prompt,
                memory=memory,
                tool_context=tool_context,
                approvals=agent.approval_required,
                workspace_context=request.context or "",
            )

            messages = list(request.history)
            if not messages or messages[-1].content != request.message:
                messages.append(GatewayMessage(role="user", content=request.message))

            generation = GenerationRequest(
                capability=capability,
                messages=messages,
                system=system,
                metadata={
                    "agent": agent.slug,
                    "tool_context": tool_context,
                    "task_id": task_id,
                    "conversation_id": request.conversation_id,
                },
            )

            await repo.update_task(task_id, model=spec.model, provider=spec.provider)
            await repo.add_task_event(
                task_id,
                kind="model.request",
                level="model",
                message=f"Generating with {spec.model}",
                detail=f"{spec.provider} · capability {capability}",
                data={"provider": spec.provider, "model": spec.model, "role": capability},
            )
            if step_rows:
                await self._step(
                    step_rows[-1], len(plan) - 1, plan[-1].title, "running"
                )

            chunks: list[str] = []
            usage = None
            cost = 0.0
            finish_reason = "stop"
            provider = spec.provider
            model = spec.model

            async for event in gateway.stream(generation):
                if controls.is_cancelled(task_id):
                    raise TaskCancelled("Task cancelled by user")
                if event.type == "delta":
                    chunks.append(event.text)
                    yield {"type": "delta", "text": event.text}
                elif event.type == "done":
                    usage = event.usage
                    cost = event.cost_usd
                    provider = event.provider or provider
                    model = event.model or model
                    finish_reason = event.finish_reason or finish_reason
                    if event.role and event.role != capability:
                        capability = event.role
                elif event.type == "error":
                    raise RuntimeError(event.error or "Generation failed")

            answer = "".join(chunks).strip()
            await repo.add_message(
                conversation_id=request.conversation_id or "",
                role="assistant",
                content=answer,
                user_id=request.user_id,
                model=model,
                provider=provider,
                tokens=usage.total_tokens if usage else 0,
                meta={"agent": agent.slug, "task_id": task_id},
            )
            await repo.update_task(
                task_id,
                status="completed",
                progress=100,
                result=answer,
                model=model,
                provider=provider,
                cost_usd=cost,
                finished_at=datetime.now(UTC),
                meta={
                    "model_role": capability,
                    "agent": agent.slug,
                    "sources": sources,
                },
            )
            if step_rows:
                await self._step(
                    step_rows[-1], len(plan) - 1, plan[-1].title, "done", "Ready"
                )
            if usage:
                await repo.record_usage(
                    provider=provider,
                    model=model,
                    capability=capability,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    cost_usd=cost,
                    task_id=task_id,
                    user_id=request.user_id,
                )
            await repo.add_task_event(
                task_id,
                kind="task.completed",
                level="success",
                message="Task completed",
                detail=f"{len(chunks)} chunk(s) streamed from {model}.",
                data={
                    "provider": provider,
                    "model": model,
                    "cost_usd": cost,
                    "usage": usage.model_dump() if usage else None,
                    "sources": len(sources),
                },
            )

            yield {
                "type": "done",
                "task_id": task_id,
                "message": answer,
                "agent": agent.describe(),
                "model": {"provider": provider, "name": model, "role": capability},
                "usage": usage.model_dump() if usage else None,
                "cost_usd": cost,
                "finish_reason": finish_reason,
            }
        except TaskCancelled:
            logger.info("task %s cancelled", task_id)
            current = await repo.get_task(task_id)
            if current:
                for step in current.steps:
                    if step.status in {"pending", "running"}:
                        await repo.update_step(step.id, status="skipped")
            await repo.update_task(
                task_id,
                status="cancelled",
                error="Cancelled by user",
                finished_at=datetime.now(UTC),
            )
            await repo.add_task_event(
                task_id,
                kind="task.cancelled",
                level="warning",
                message="Task cancelled by user",
                detail="No further steps will run.",
            )
            yield {"type": "error", "task_id": task_id, "error": "Task cancelled by user"}
        except Exception as exc:
            logger.exception("orchestration failed")
            await repo.update_task(
                task_id, status="failed", error=str(exc), finished_at=datetime.now(UTC)
            )
            await repo.add_task_event(
                task_id,
                kind="task.failed",
                level="error",
                message="Task failed",
                detail=str(exc),
            )
            yield {"type": "error", "task_id": task_id, "error": str(exc)}
        finally:
            controls.forget(task_id)

    # -- helpers ------------------------------------------------------------
    def _capability(self, requested: str | None) -> str:
        if requested and requested in registry.roles:
            return requested
        return registry.default_role

    def _build_plan(self, agent: Agent, message: str) -> list[AgentPlanStep]:
        plan = [AgentPlanStep("Understanding your request")]
        if agent.slug != "core":
            plan.append(AgentPlanStep(f"Selecting the {agent.name} agent"))
        plan.extend(agent.plan(message))
        plan.append(AgentPlanStep("Composing your answer"))
        return plan

    def _title(self, message: str) -> str:
        first = message.strip().splitlines()[0] if message.strip() else "Untitled task"
        return first[:120]

    async def _step(
        self,
        row_id: str | None,
        index: int,
        title: str,
        status: str,
        detail: str | None = None,
    ) -> None:
        now = datetime.now(UTC)
        fields: dict[str, Any] = {"status": status, "detail": detail, "title": title}
        if status == "running":
            fields["started_at"] = now
        if status in {"done", "failed", "skipped"}:
            fields["finished_at"] = now
        await repo.update_step(row_id, **fields)


orchestrator = Orchestrator()
