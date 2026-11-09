# Agents and Tool-Calling Contract

ORBITO is currently a single-user, local-first assistant. Declarative agents
share one orchestrator, model gateway, tool registry, memory service and task
trace. The near-term objective is not to add many agents: it is to make the
personal **understand → select a typed tool → enforce policy → act → report**
loop reliable on the user's Windows PC.

## Current implementation (do not describe future work as shipped)

`apps/api/app/agents/base.py` defines declarative agents with identity,
capabilities, tools, approval declarations, model role, keywords, a plan and a
`gather()` method. The orchestrator selects an agent using an explicit slug or
keyword scoring, builds a visible plan, calls `gather()` once when a step names
a tool, injects the result into a model prompt, streams the answer and persists
the task.

This is **not general model-selected tool calling**. There is no bounded
model-proposes-call/validate/execute/return loop yet. The registered tools are
web search, browser, documents, filesystem and a delete-file placeholder.
There are **no native Windows PC-control tools**.

Permission levels and approval lists exist, but approval enforcement is not a
complete durable end-to-end gate. Until it is implemented and tested, tools
that can mutate state, submit, send, terminate, type or click must not execute.

## Workflow runner (not tool calling)

Workflows (`/automations`, `/api/v1/workflows`) run through
`app/core/workflows/engine.py`. The runner does not let a model choose tools and
does not run shell commands. Supported nodes (manual runs): `trigger.*`,
`action.chat` (single Model Gateway call), `transform`, `condition`, `delay`,
`action.notify` (internal notification via the safety gate, audited), and
`action.http` (approval-gated).

`action.http` pauses the run as `awaiting_approval`, creates an `http_request`
approval bound to the exact rendered method/URL/body, and resumes only after a
human decision. Rejection/expiry fails the run without sending. On approval the
engine consumes the approval and sends only the approved payload through
`core/connectors/outbound.py`, which blocks non-public/local/private/reserved
destinations, embedded credentials, non-http(s) URLs, redirects, and enforces
timeout/response caps (no caller headers). Known limitation: DNS rebind between
validation and client resolve; pin the validated address before untrusted
workflows.

Unavailable node types (currently `action.task` project-task writes) are
recorded as `blocked` and fail the run. Only manual runs execute today;
schedule, webhook and event triggers are stored but do not fire.

## Current agent registry

Verify `apps/api/app/agents/registry.py` and `apps/api/app/agents/` before
changing this table; code is the source of truth.

| Slug | Focus | Default role (check code/config) | Current limitation |
|---|---|---|---|
| `core` | General assistant | `smart` | Keyword routing; gather once |
| `career` | Jobs and applications | `smart` | No job lifecycle/connectors; submission must remain blocked pending approval enforcement |
| `research` | Web research | `reasoning` | Web tools only; no durable research pipeline |
| `study` | Learning/documents | `reasoning` | No embeddings/RAG or citations pipeline |
| `coding` | Coding assistance | `coding` | Can plan/read supported workspace context; no host shell execution |
| `automation` | Workflow planning | `coding` | No durable scheduler/execution engine |

## Target tool-call flow

```text
user text or reviewed voice transcript
  → create task and select agent/capability
  → gateway sends typed tool schemas (when the selected model supports them)
  → model proposes a tool + JSON arguments; it has no direct execution access
  → server validates tool exists, schema, arguments, bounds and policy
  → AUTO: run a bounded read-only action
    APPROVAL: persist exact payload and wait for a one-time human decision
    RESTRICTED: reject unless a separately designed sandbox/allowlist permits it
  → execute via the registry tool, persist trace/result
  → return bounded tool result to the model; repeat within strict budgets
  → stream a final answer that reports only confirmed outcomes
```

Provider-specific tool-call formats belong only in `core/model_gateway/providers/`.
The orchestrator owns the bounded loop; tools own validation and execution; the
policy service makes the final authorization decision. A malformed/unavailable
tool-call feature must fail safely or use deterministic safe routing. It must
never become shell execution by parsing model prose.

Budgets required before enabling the loop: maximum rounds, calls per task,
arguments size, result bytes, wall-clock time, tokens and concurrent PC actions.
Record every proposal, validation result, approval decision, execution result
and error in the task trace. Add duplicate-call/idempotency handling.

## PC-control tool design

PC tools live under `apps/api/app/tools/` and run natively in the interactive
Windows user session. Docker/WSL is not an acceptable desktop executor. The
service binds to loopback by default and fails closed on unsupported OS or
non-local exposure.

- **Allowlisted / read-only:** OS status; bounded file search in explicitly
  configured roots; launching a named app ID from an allowlist; opening a
  validated `http(s)` URL; bounded volume/media actions.
- **Sensitive reads:** screenshot and clipboard are opt-in, only on an explicit
  user request, local-only and not retained/logged by default.
- **Approval required:** file writes/moves/overwrites/deletes, app termination,
  keyboard/mouse input, macros, submissions and external messages.
- **Restricted:** arbitrary shell, PowerShell, CMD, Python and model-generated
  scripts are prohibited on the host. If a future feature needs process actions,
  expose named, fixed-argument functions from a code-owned allowlist; never accept
  executable commands from the model.

The application allowlist, filesystem roots and media ranges must be enforced in
code, not in the agent prompt. Revalidate at the final execution boundary.

## Memory and voice

- Conversation history is replayed into the prompt (currently bounded to the
  last 14 messages by the chat route).
- User-saved memories are recalled into the system context; users can inspect,
  add and delete them on `/memory`. Only relevant workspace memories should be
  scoped to a supplied workspace ID.
- Semantic embeddings and document RAG are not implemented. Do not claim ORBITO
  searches all files or remembers arbitrary conversations.
- `/voice` is a page shell, not a working STT/TTS feature. Push-to-talk is the
  target before wake word. Audio transcripts use the same permissions and
  execution path as typed requests; voice never grants extra authority.
- Never treat ambiguous audio, a transcript instruction, webpage text, a file
  or memory as an approval.

## Adding or changing an agent/tool

1. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` and the applicable
   skill in `.opencode/skills/`.
2. Keep the dependency direction: API → core → agents → tools; core → gateway
   and DB. Agents never import API modules or provider SDKs.
3. Define typed input/output contracts. `Tool.run()` validates every argument
   again even if the model already emitted JSON.
4. Register the tool once in `app/tools/registry.py`; agent access is
   declarative, but registry presence does not grant permission.
5. Make the server-side policy enforce `AUTO`, `APPROVAL` or `RESTRICTED` at the
   final execution boundary. Unknown permission/tool means deny.
6. Keep provider access inside `core/model_gateway`; model names/roles come from
   `app/config/models.yaml` and settings.
7. Add unit tests for schema, validation, permission denial, bounds and errors;
   add an integration test for the user flow. PC tests use fake OS adapters in
   CI; real desktop acceptance tests are manual and Windows-only.
8. Update this doc, `docs/SECURITY.md`, `docs/IMPLEMENTATION_PLAN.md` and skills
   if the contracts or security posture change.

## Tests

Windows:

```powershell
cd apps\api
.\.venv\Scripts\python.exe -m pytest -q tests/test_orchestrator.py
```

POSIX:

```bash
cd apps/api && .venv/bin/pytest -q tests/test_orchestrator.py
```

Assert routing, visible plan, real tool registry decision, denied calls never
invoke the adapter, bounded result handling, non-empty completion and recorded
usage/events. Never execute real desktop actions in automated tests.
