"""Workflow runner: executes queued workflow runs node by node.

Honesty rules:
- Every node result is stored with its real status, timing and output or error.
- A node type that is not implemented (project-task writes) is `blocked`, and the run fails.
- Outbound HTTP (`action.http`) is approval-gated. The run pauses in
  `awaiting_approval` with an approval bound to the exact method, URL and body.
  Approval resumes the run; rejection or expiry fails it. The gate consumes the
  approval at execution time, so a changed request cannot reuse it.
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
from app.core.connectors import OutboundBlocked, send_http_request
from app.core.model_gateway import GenerationRequest, Message, gateway
from app.core.safety import ActionDenied, authorize, request_approval
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
    "action.http",
    "action.notify",
    "transform",
    "condition",
    "delay",
}

MAX_DELAY_SECONDS = 60.0
AWAITING = "awaiting_approval"


class NodeFailure(Exception):
    """A node could not run. `blocked` means the node type is not available yet."""

    def __init__(self, message: str, *, blocked: bool = False) -> None:
        super().__init__(message)
        self.blocked = blocked


class ApprovalNeeded(Exception):
    """Raised by a node that must wait for a human decision before it may run."""

    def __init__(self, action: str, payload: dict[str, Any], summary: str) -> None:
        super().__init__(summary)
        self.action = action
        self.payload = payload
        self.summary = summary


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
                await self.resolve_awaiting()
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

    # -- approvals ----------------------------------------------------------
    async def resolve_awaiting(self) -> int:
        """Resume or fail runs whose pending approval has been decided. Returns runs changed."""
        changed = 0
        for run in await repo.list_runs_with_status(AWAITING):
            state = (run.output or {}).get("state") or {}
            pending = state.get("pending") or {}
            approval_id = pending.get("approval_id")
            if not approval_id:
                continue
            approval = await repo.get_approval(approval_id, user_id=run.user_id)
            if approval is None:
                continue
            if approval.status == "approved":
                await repo.update_workflow_run(
                    run.id,
                    status="queued",
                    log=(run.log or "") + f"\n[{_now()}] Approval approved. Resuming.",
                )
                changed += 1
            elif approval.status in {"rejected", "expired"}:
                output = dict(run.output or {})
                nodes = [
                    {**n, "status": "blocked", "error": f"Approval {approval.status}; not executed."}
                    if n.get("id") == pending.get("node_id") and n.get("status") == AWAITING
                    else n
                    for n in output.get("nodes", [])
                ]
                output["nodes"] = nodes
                output["state"] = None
                message = f"Approval {approval.status}. The request was not sent."
                await repo.update_workflow_run(
                    run.id,
                    status="failed",
                    error=message,
                    output=output,
                    log=(run.log or "") + f"\n[{_now()}] {message}",
                    finished_at=datetime.now(UTC),
                )
                changed += 1
        return changed

    # -- execution ----------------------------------------------------------
    async def execute_run(self, run_id: str) -> None:
        """Execute or resume one run. Assumes the run is claimed (status `running`)."""
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

        previous_output = dict(run.output or {})
        state = previous_output.get("state") or {}
        node_results: list[dict[str, Any]] = [
            n for n in previous_output.get("nodes", []) if n.get("status") != AWAITING
        ]
        final_text: str = previous_output.get("final_text", "")
        log: list[str] = (run.log or "").splitlines() if state else [f"[{_now()}] Run started ({run.triggered_by})."]
        approvals: dict[str, str] = {}
        visited: set[str] = set(state.get("visited") or [])
        status = "completed"
        error: str | None = None
        suspended = False

        async def checkpoint() -> None:
            await repo.update_workflow_run(
                run_id,
                output={"nodes": node_results, "final_text": final_text, "state": None},
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
            if state.get("queue"):
                queue: deque[tuple[str, str]] = deque((str(a), str(b)) for a, b in state["queue"])
            else:
                queue = deque((node_id, "") for node_id in starts)
            pending = state.get("pending") or {}
            if pending.get("node_id"):
                approvals[pending["node_id"]] = pending["approval_id"]
                log.append(f"[{_now()}] Resuming {pending['node_id']} with approval {pending['approval_id']}.")

            while queue:
                node_id, previous = queue.popleft()
                if node_id in visited and node_id not in approvals:
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
                        self._run_node(
                            node,
                            previous,
                            run_input,
                            workflow.name,
                            approval_id=approvals.get(node_id),
                        ),
                        timeout=settings.workflow_node_timeout_seconds,
                    )
                except ApprovalNeeded as exc:
                    approval = await request_approval(
                        action=exc.action,
                        payload=exc.payload,
                        summary=exc.summary,
                        requested_by=f"workflow_run:{run_id}",
                    )
                    if approval is None:
                        raise NodeFailure("Approval store unavailable; the request was not sent.") from exc
                    entry["status"] = AWAITING
                    entry["approval_id"] = approval.id
                    entry["finished_at"] = None
                    log.append(f"[{_now()}] {label} is waiting for approval {approval.id}.")
                    state = {
                        "queue": [[node_id, previous], *[[a, b] for a, b in queue]],
                        "visited": sorted(visited - {node_id}),
                        "pending": {"node_id": node_id, "previous": previous, "approval_id": approval.id},
                    }
                    await repo.update_workflow_run(
                        run_id,
                        status=AWAITING,
                        output={"nodes": node_results, "final_text": final_text, "state": state},
                        log="\n".join(log),
                    )
                    suspended = True
                    break
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

                for successor, _edge_label in self._successors(node_id, node_type, output, edges):
                    if successor not in visited:
                        queue.append((successor, text))

            if suspended:
                return

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
            output={"nodes": node_results, "final_text": final_text, "state": None},
            log="\n".join(log),
            finished_at=datetime.now(UTC),
        )
        if status == "failed":
            await repo.create_notification(
                title=f"Workflow run failed: {workflow.name}",
                body=error,
                kind="workflow",
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
        *,
        approval_id: str | None = None,
    ) -> dict[str, Any]:
        node_type = str(node.get("type") or "")
        config = node.get("config") if isinstance(node.get("config"), dict) else {}

        if node_type not in SUPPORTED_NODES:
            raise NodeFailure(
                f"Node type '{node_type}' is not available yet. It needs an approval-gated "
                "connector before it can run.",
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

        if node_type == "action.notify":
            title = _render(str(config.get("title") or "Workflow notification"), context).strip()[:200]
            body = _render(str(config.get("body") or "{{previous}}"), context).strip()
            if not title:
                raise NodeFailure("Notification needs a title.")
            payload = {"title": title, "body": body}
            try:
                await authorize("send_notification", payload)
            except ActionDenied as exc:
                raise NodeFailure(f"Notification denied: {exc.reason}") from exc
            notification_id = await repo.create_notification(title=title, body=body or None, kind="workflow")
            if notification_id is None:
                raise NodeFailure("Notification could not be stored.")
            return {"text": body, "notification_id": notification_id}

        if node_type == "action.http":
            method = str(config.get("method") or "GET").upper()
            url = _render(str(config.get("url") or ""), context).strip()
            raw_body = config.get("body")
            body: Any = None
            if raw_body not in (None, ""):
                body = _render(raw_body, context) if isinstance(raw_body, str) else raw_body
            if not url:
                raise NodeFailure("HTTP node needs a URL.")
            payload = {"method": method, "url": url, "body": body}
            if approval_id is None:
                raise ApprovalNeeded(
                    "http_request",
                    payload,
                    f"Workflow sends {method} {url}",
                )
            # Execute exactly what the human approved, not a re-rendered copy of it.
            approved = await repo.get_approval(approval_id)
            if approved is None or approved.action != "http_request":
                raise NodeFailure("Request not sent: approval not found.")
            payload = dict(approved.payload or {})
            method = str(payload.get("method") or method)
            url = str(payload.get("url") or url)
            body = payload.get("body")
            try:
                await authorize("http_request", payload, approval_id=approval_id)
            except ActionDenied as exc:
                raise NodeFailure(f"Request not sent: approval {exc.reason}.") from exc
            try:
                response = await send_http_request(method, url, body)
            except OutboundBlocked as exc:
                raise NodeFailure(f"Request blocked: {exc}") from exc
            except Exception as exc:
                raise NodeFailure(f"Request failed: {exc}") from exc
            if response["status_code"] >= 400:
                raise NodeFailure(f"HTTP {response['status_code']} from {url}")
            return {"text": response["text"], **response}

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
