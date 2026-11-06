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
from typing import Any

from app.agents.base import Agent, AgentPlanStep
from app.agents.registry import agents
from app.core.memory.store import build_system_prompt, maybe_capture, recall
from app.core.model_gateway import GenerationRequest, Message as GatewayMessage
from app.core.model_gateway import gateway, registry
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


class Orchestrator:
    async def run(self, request: OrchestratorRequest) -> AsyncIterator[dict[str, Any]]:
        agent = agents.select(request.message, request.agent_slug)
        capability = self._capability(request.model_role or agent.model_role)
        spec = registry.get(capability)

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
        try:
            for index, step in enumerate(plan):
                await self._step(step_rows[index], index, step.title, "running")
                yield {
                    "type": "step.updated",
                    "index": index,
                    "title": step.title,
                    "status": "running",
                    "detail": None,
                }

                detail: str | None = None
                if step.tool:
                    result = await agent.gather(request.message, {"task_id": task_id})
                    if result is not None:
                        if result.ok:
                            tool_context = result.summary
                            detail = result.summary[:240] or "Done"
                            yield {
                                "type": "sources",
                                "sources": result.sources,
                            }
                        else:
                            detail = result.error or "Tool unavailable"
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
                yield {
                    "type": "step.updated",
                    "index": index,
                    "title": step.title,
                    "status": "done",
                    "detail": detail,
                }
                await asyncio.sleep(0.12)

            memory = await recall(request.user_id)
            await maybe_capture(request.user_id, request.message, request.workspace_id)

            system = build_system_prompt(
                ORBITO_BASE,
                agent_prompt=agent.system_prompt,
                memory=memory,
                tool_context=tool_context,
                approvals=agent.approval_required,
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
        except Exception as exc:
            logger.exception("orchestration failed")
            await repo.update_task(task_id, status="failed", error=str(exc))
            yield {"type": "error", "task_id": task_id, "error": str(exc)}

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
        await repo.update_step(row_id, status=status, detail=detail, title=title)


orchestrator = Orchestrator()
