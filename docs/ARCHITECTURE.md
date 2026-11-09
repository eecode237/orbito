# ORBITO Architecture

**One agent. Infinite possibilities.**

ORBITO is a personal, local-first AI operating system, not a model. Its primary
loop is listen (text first, push-to-talk next) → understand → propose safe
actions → execute only through validated tools and approval policy → report the
real result. Requests are planned into visible steps, answered by whichever
model the gateway selects, and persisted with their costs and traces.

## 1. Shape of the system

```text
                    Next.js dashboard (apps/web)
                              |
                     /api/v1 (HTTP + SSE)
                              |
                    FastAPI service (apps/api)
                              |
        +---------------------+---------------------+
        |                     |                     |
   Orchestrator          Agent registry        Task/memory store
   (route → plan →       (core, career,        (SQLAlchemy)
    tools → answer)       research, study,
        |                 coding, automation)
        |
   Model Gateway  ──►  OpenAI · Anthropic · Google · Mistral · Ollama · mock
        |
   Tool registry  ──►  web_search · browser · documents · filesystem
        |
   Scraping engine ──►  HTTP fetch · CSS schema extraction · depth crawl
```

Foundation v0.1 is a **modular monolith**: one API process, one database, one
cache, plus a Next.js app. This is intentional. Long-running work (agent runs,
scraping, media) has an explicit seam (`schedule_job`, task records) so it can
move to Celery workers without rewriting callers.

## 2. Module boundaries

Import direction is enforced by review and by the rules in `AGENTS.md`:

```text
api  →  core  →  agents  →  tools
        |
        └──→  model_gateway
        └──→  db
```

- `api/` only translates HTTP ↔ domain calls. No provider logic.
- `core/orchestrator` owns the run loop and persistence.
- `agents/` declare identity, plan shape, allowed tools, approvals.
- `tools/` own network/file access and validation.
- `model_gateway/` is the only code allowed to talk to model APIs.
- `db/` is the only code allowed to query the database.
- `tools/` is also the only layer allowed to interact with the host PC. Desktop
  adapters validate inputs and call the permission service before execution.

## 3. Request lifecycle

A `POST /api/v1/chat` with streaming requested produces this SSE sequence:

```text
event: conversation     conversation_id
event: task.created     agent, resolved model, plan steps
event: step.updated     running/done/failed per step (with detail)
event: sources          URLs returned by tools
event: delta            streamed answer tokens
event: done             final message, usage, cost, model
event: error            failure with a user-safe message
```

Orchestrator state:

```text
receive
  → resolve agent (explicit slug or keyword scoring)
  → resolve capability (agent default or user selection)
  → create task + step rows
  → for each step:
       mark running → run tool if the step declares one → mark done/failed
  → recall memory + capture "remember that…"
  → build system prompt (agent persona + memory + tool output + approvals)
   → stream model through the gateway (future: typed tool-call proposal loop)
  → persist assistant message, task result, usage, cost
```

Ordering matters: task rows are created before streaming so a dropped
connection still leaves an inspectable trace.

## 4. Model Gateway

Every generation resolves through `ModelGateway.resolve(capability)`:

1. Role from `app/config/models.yaml` (env overrides allowed).
2. Ordered fallback chain per role.
3. Unconfigured providers are skipped.
4. A provider error before the first token falls through to the next model.
5. `mock` is the terminal fallback so the product loop never dead-ends.

The gateway normalises streaming, token accounting, cost estimation and
provider errors. Callers see `ModelSpec` + `StreamEvent`, never vendor SDKs.

See [MODELS.md](MODELS.md).

## 5. Agents

An agent is a declarative object: slug, persona, capabilities, tools, approval
list, model role, and a plan builder. The orchestrator executes plans, so
behaviour (streaming, persistence, approvals, cost) is uniform across agents.

Routing is deterministic keyword scoring today. It is deliberately inspectable
and testable; a model-assisted router can replace `AgentRegistry.select`
without touching anything else.

See [AGENTS.md](AGENTS.md).

## 6. Tools, scraping and PC execution boundary

Tools declare a permission level:

- `auto` — safe reads (search, fetch a public page, extract a document).
- `approval` — writes, deletes, submissions, emails.
- `restricted` — shell, sandbox only.

The current permission enum is metadata and several approval declarations are
not enforced end-to-end. **Do not mistake this for a working approval queue.**
Before any desktop action that writes, deletes, closes an app or injects input,
the execution boundary must validate a one-time approval bound to the exact
normalized action payload. A prompt or agent persona is never the security
boundary.

The target product is a single-user Windows workstation. Desktop-control tools
must execute natively in the interactive Windows session; Docker/WSL is not the
desktop execution environment. While enabled, the API binds to `127.0.0.1` by
default, tools fail closed off Windows or off loopback, and a kill switch disables
them. Remote/LAN operation is a separate design requiring authentication,
pairing, origin/CSRF protections and explicit user opt-in.

Initial desktop tools use schemas and allowlists, not commands generated by the
model. `open_app` accepts a code/user-configured app ID, never an executable
string. `open_url` permits only validated `http(s)` targets. File search stays in
configured roots. Screenshot and clipboard are explicit-request, local-only,
non-retained and opt-in because they can expose private data. File mutations,
process termination and keyboard/mouse injection require approval. Arbitrary
shell/PowerShell/CMD/Python on the host is prohibited. Any future process action
must be a named, fixed-argument allowlisted function and remain restricted.

Model-selected tool calling is a planned gateway/orchestrator capability, not
current behavior. The model proposes a typed call; server code validates the
schema, registry membership, permission, approval and bounds, executes it, and
returns the actual result. Cap rounds, tools, runtime, tokens and output size;
trace every proposal and outcome. If the local model/provider cannot reliably
emit tool calls, explain or use safe deterministic routing—never interpret text
as shell.

Scraping is first-class: `POST /scraping/jobs` creates a job, a background task
fetches and extracts pages, results stream into `scraping_results`, and the UI
polls progress/exports. All fetches pass SSRF validation (`tools/net.py`).

## 7. Persistence

PostgreSQL is the production source of truth; SQLite is the zero-setup dev
default. Schema and relationships are in [DATABASE.md](DATABASE.md). Media is
stored in object storage (S3/R2/MinIO), never in the database.

## 8. Realtime

Foundation v0.1 uses HTTP SSE for chat and polling for scraping. Redis is
provisioned and reserved for: cross-process task events (WebSockets), the
Celery broker, rate limits and cache. The API already runs without Redis.

## 9. Frontend

Next.js App Router, React 19, Tailwind v4, Framer Motion available, lucide
icons. The UI is split into:

- design primitives (`globals.css` tokens, brand mark, mascot),
- app shell (sidebar, topbar, responsive drawer),
- feature surfaces (overview, chat, agents, scraping, settings, activity),
- typed API client with an SSE parser (`lib/api.ts`).

No API keys or provider calls ever reach the browser.

## 10. Key decisions

| Decision | Rationale |
|---|---|
| Modular monolith first | Ship the product loop; split workers when load demands it. |
| Deterministic orchestrator now | Streaming, cancellation and tests are simpler; the shape maps to a LangGraph `StateGraph` later. |
| SQLite dev default | `make dev` works on a clean machine. Postgres is one env var away. |
| Mock provider | CI, demos and fresh clones stay fully usable with no keys. |
| Gateway owns provider access | Swap models, compare cost, fail over without touching agents. |
| SSE over WebSockets (v0.1) | One-way token/trace streaming is enough; proxies treat it well. |

## 11. Planned evolution — personal Jarvis order

See [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for acceptance criteria.

1. Verify local Ollama end-to-end.
2. Enforced one-time approvals, local-only safety guard, audit trail and kill
   switch.
3. Native Windows read-only/allowlisted PC tools.
4. Bounded model tool calling through the gateway and orchestrator.
5. Approved state-changing PC tools and durable, opt-in workflows.
6. Push-to-talk with local STT/TTS; wake word much later and opt-in.
7. User-controlled local embeddings/RAG and then proactive briefings.

Accounts/billing/RLS, remote PC control, LiveKit-first voice, LangGraph and
microservices are deferred until actual usage requires them. This is a
single-user product priority, not permission to weaken local security.
