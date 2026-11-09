"""Workflow runner: executes queued workflow runs node by node.

Honesty rules:
- Every node result is stored with its real status, timing and output or error.
- A node type that is not implemented (external HTTP, notifications, task writes)
  is `blocked`, and the run fails. It is never silently skipped or marked done.
- Model output comes only from the Model Gateway. If the gateway falls back to the
  offline mock provider, the node output says so.
- Runs are claimed atomically, so two runner loops cannot execute the same run.
"""

from __future__ import annotations

import asyncio
import json
from collections import deque
from datetime import UTC, datetime
from typing import Any

from app.config import settings
from app.core.model_gateway import GenerationRequest, Message, gateway
from app.db import repositories as repo
from app.logging import get_logger

logger = get_logger(__name__)

SUPPORTED_NODES = {
    "trigger.manual",
    "trigger.schedule",
    "trigger.webhook",
    "trigger.event",
    "trigger.chat",
    "action.chat",
    "transform",
    "condition",
    "delay",
}

MAX_DELAY_SECONDS = 60.0


class NodeFailure(Exception):
    """A node could not run. `blocked` means the node type is not available yet."""

    def __init__(self, message: str, *, blocked: bool = False) -> None:
        super().__init__(message)
        self.blocked = blocked


def _now() -> str:
    return datetime.now(UTC).strftime("%H:%M:%S")


def _render(template: str, context: dict[str, str]) -> str:
    rendered = template
    for key, value in context.items():
        rendered = rendered.replace("{{" + key + "}}", value)
    return rendered


def _ordered_nodes(definition: dict[str, Any]) -> tuple[dict[str, dict], list[str], list[dict]]:
    nodes = [n for n in definition.get("nodes", []) if isinstance(n, dict) and n.get("id")]
    by_id = {str(n["id"]): n for n in nodes}
    edges = [
        e
        for e in definition.get("edges", [])
        if isinstance(e, dict) and str(e.get("source")) in by_id and str(e.get("target")) in by_id
    ]
    incoming = {str(e["target"]) for e in edges}
    starts = [node_id for node_id in by_id if node_id not in incoming]
    return by_id, starts, edges


class WorkflowEngine:
    def __init__(self) -> None:
        self._wake: asyncio.Event | None = None
        self._task: asyncio.Task | None = None

    # -- lifecycle ----------------------------------------------------------
    def start(self) -> None:
        if not settings.workflow_runner_enabled or self._task is not None:
            return
        self._wake = asyncio.Event()
        self._task = asyncio.create_task(self._loop(), name="orbito-workflow-runner")
        logger.info("workflow runner started")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except (asyncio.CancelledError, Exception):
            pass
        self._task = None
        self._wake = None

    def wake(self) -> None:
        if self._wake is not None:
            self._wake.set()

    async def _loop(self) -> None:
        while True:
            try:
                run_id = await repo.claim_next_queued_workflow_run()
                if run_id:
                    await self.execute_run(run_id)
                    continue
            except asyncio.CancelledError:
                raise
            except Exception:  # pragma: no cover - keep the runner alive
                logger.exception("workflow runner loop error")
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=settings.workflow_runner_poll_seconds)
            except TimeoutError:
                pass
            self._wake.clear()

    # -- execution ----------------------------------------------------------
    async def execute_run(self, run_id: str) -> None:
        """Execute one run. Assumes the run is already claimed (status `running`)."""
        run = await repo.get_workflow_run(run_id)
        if run is None:
            return
        workflow = await repo.get_workflow_by_id(run.workflow_id)
        if workflow is None:
            await repo.update_workflow_run(
                run_id,
                status="failed",
                error="Workflow no longer exists.",
                finished_at=datetime.now(UTC),
            )
            return
        if run.status != "running":
            await repo.update_workflow_run(run_id, status="running", started_at=datetime.now(UTC))

        log: list[str] = [f"[{_now()}] Run started ({run.triggered_by})."]
        node_results: list[dict[str, Any]] = []
        final_text = ""
        status = "completed"
        error: str | None = None

        async def checkpoint() -> None:
            await repo.update_workflow_run(
                run_id,
                output={"nodes": node_results, "final_text": final_text},
                log="\n".join(log),
            )

        try:
            definition = workflow.definition or {}
            by_id, starts, edges = _ordered_nodes(definition)
            if not by_id:
                raise NodeFailure("Workflow has no nodes to execute.")
            if len(by_id) > settings.workflow_max_nodes:
                raise NodeFailure(f"Workflow has more than {settings.workflow_max_nodes} nodes.")
            if not starts:
                raise NodeFailure("Workflow has a cycle and no starting node.")

            run_input = run.input or {}
            queue: deque[tuple[str, str]] = deque((node_id, "") for node_id in starts)
            visited: set[str] = set()

            while queue:
                node_id, previous = queue.popleft()
                if node_id in visited:
                    continue
                visited.add(node_id)
                node = by_id[node_id]
                node_type = str(node.get("type") or "")
                label = str(node.get("label") or node_id)
                entry: dict[str, Any] = {
                    "id": node_id,
                    "type": node_type,
                    "label": label,
                    "status": "running",
                    "started_at": datetime.now(UTC).isoformat(),
                    "finished_at": None,
                    "output": None,
                    "error": None,
                }
                node_results.append(entry)
                log.append(f"[{_now()}] {label} ({node_type}) started.")
                await checkpoint()

                try:
                    output = await asyncio.wait_for(
                        self._run_node(node, previous, run_input, workflow.name),
                        timeout=settings.workflow_node_timeout_seconds,
                    )
                except NodeFailure as exc:
                    entry["status"] = "blocked" if exc.blocked else "failed"
                    entry["error"] = str(exc)
                    entry["finished_at"] = datetime.now(UTC).isoformat()
                    log.append(f"[{_now()}] {label} {entry['status']}: {exc}")
                    await checkpoint()
                    raise
                except TimeoutError as exc:
                    message = f"Timed out after {settings.workflow_node_timeout_seconds:.0f}s."
                    entry["status"] = "failed"
                    entry["error"] = message
                    entry["finished_at"] = datetime.now(UTC).isoformat()
                    log.append(f"[{_now()}] {label} failed: {message}")
                    await checkpoint()
                    raise NodeFailure(message) from exc

                entry["status"] = "completed"
                entry["output"] = output
                entry["finished_at"] = datetime.now(UTC).isoformat()
                log.append(f"[{_now()}] {label} completed.")
                text = str(output.get("text", ""))
                if text:
                    final_text = text
                await checkpoint()

                for successor, edge_label in self._successors(node_id, node_type, output, edges):
                    if successor not in visited:
                        queue.append((successor, text))

            log.append(f"[{_now()}] Run completed.")
        except NodeFailure as exc:
            status = "failed"
            error = str(exc)
            log.append(f"[{_now()}] Run failed: {exc}")
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("workflow run %s crashed", run_id)
            status = "failed"
            error = f"Unexpected runner error: {exc}"
            log.append(f"[{_now()}] Run failed: {error}")

        await repo.update_workflow_run(
            run_id,
            status=status,
            error=error,
            output={"nodes": node_results, "final_text": final_text},
            log="\n".join(log),
            finished_at=datetime.now(UTC),
        )
        await repo.record_audit(
            "workflow.run",
            resource=f"workflow:{run.workflow_id}",
            outcome="ok" if status == "completed" else "error",
            detail={
                "run_id": run_id,
                "nodes": len(node_results),
                "status": status,
                "error": error,
            },
        )

    @staticmethod
    def _successors(
        node_id: str, node_type: str, output: dict[str, Any], edges: list[dict]
    ) -> list[tuple[str, str | None]]:
        outgoing = [e for e in edges if str(e.get("source")) == node_id]
        if node_type == "condition":
            # Condition edges must be labelled "true" or "false"; only the matching branch runs.
            branch = "true" if output.get("result") else "false"
            return [
                (str(e["target"]), e.get("label"))
                for e in outgoing
                if str(e.get("label") or "").lower() == branch
            ]
        return [(str(e["target"]), e.get("label")) for e in outgoing]

    async def _run_node(
        self,
        node: dict[str, Any],
        previous: str,
        run_input: dict[str, Any],
        workflow_name: str,
    ) -> dict[str, Any]:
        node_type = str(node.get("type") or "")
        config = node.get("config") if isinstance(node.get("config"), dict) else {}

        if node_type not in SUPPORTED_NODES:
            raise NodeFailure(
                f"Node type '{node_type}' is not available yet. External integrations "
                "need an approval-gated connector before they can run.",
                blocked=True,
            )

        context = {
            "previous": previous,
            "input": json.dumps(run_input, ensure_ascii=False) if run_input else "",
            "now": datetime.now(UTC).isoformat(),
            "workflow": workflow_name,
        }

        if node_type.startswith("trigger."):
            text = str(run_input.get("message") or previous or "")
            return {"text": text, "trigger": node_type}

        if node_type == "transform":
            template = str(config.get("template") or "{{previous}}")
            return {"text": _render(template, context)}

        if node_type == "delay":
            try:
                seconds = float(config.get("seconds", 1))
            except (TypeError, ValueError) as exc:
                raise NodeFailure("Delay 'seconds' must be a number.") from exc
            if not 0 <= seconds <= MAX_DELAY_SECONDS:
                raise NodeFailure(f"Delay must be between 0 and {MAX_DELAY_SECONDS:.0f} seconds.")
            await asyncio.sleep(seconds)
            return {"text": previous, "waited_seconds": seconds}

        if node_type == "condition":
            mode = str(config.get("mode") or "contains")
            needle = _render(str(config.get("value") or ""), context).lower()
            haystack = previous.lower()
            if mode == "contains":
                result = needle in haystack
            elif mode == "not_contains":
                result = needle not in haystack
            elif mode == "nonempty":
                result = bool(previous.strip())
            else:
                raise NodeFailure(f"Unknown condition mode '{mode}'.")
            return {"text": previous, "result": result, "mode": mode}

        # action.chat
        prompt = _render(str(config.get("prompt") or ""), context).strip()
        if not prompt:
            raise NodeFailure("Chat action has an empty prompt. Add a prompt in the node config.")
        role = str(config.get("model_role") or "fast")
        system = str(config.get("system") or "")
        request = GenerationRequest(
            capability=role,
            messages=[Message(role="user", content=prompt)],
            system=system or None,
            metadata={"source": "workflow"},
        )
        result = await gateway.generate(request)
        text = result.text.strip()
        if not text:
            raise NodeFailure("The model returned an empty response.")
        if result.usage.total_tokens:
            await repo.record_usage(
                provider=result.provider,
                model=result.model,
                capability=role,
                prompt_tokens=result.usage.prompt_tokens,
                completion_tokens=result.usage.completion_tokens,
                cost_usd=result.cost_usd,
            )
        return {
            "text": text,
            "provider": result.provider,
            "model": result.model,
            "offline": result.provider == "mock",
            "fallback_used": result.fallback_used,
            "usage": result.usage.model_dump(),
            "cost_usd": result.cost_usd,
        }


engine = WorkflowEngine()
