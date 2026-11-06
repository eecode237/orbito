# ORBITO Architecture

**One agent. Infinite possibilities.**

ORBITO is an orchestration system, not a model. A request is routed to a
specialist agent, planned into visible steps, executed with tools, answered by
whichever model the gateway selects, and persisted with its cost and trace.

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
  → stream model through the gateway
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

## 6. Tools and scraping

Tools declare a permission level:

- `auto` — safe reads (search, fetch a public page, extract a document).
- `approval` — writes, deletes, submissions, emails.
- `restricted` — shell, sandbox only.

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

## 11. Planned evolution

- **Phase 1** — auth, real users, workspace scoping, RLS.
- **Phase 2** — richer gateway (retries, budget caps, embeddings, vision).
- **Phase 3** — LangGraph checkpointing, approval queue, agent configs.
- **Phase 4** — Playwright rendering, sitemaps, scheduled crawls, workers.
- **Phase 5** — PDF → embeddings → citations for Study; CV parsing for Career.
- **Phase 6** — LiveKit voice worker and FFmpeg media pipeline.
- **Phase 7** — billing, rate limits, OTel tracing, deployment pipelines.
