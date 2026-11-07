# ORBITO — Project Structure (Current & Target)

Verified against the repository on 2026-11-07. Rule: **create directories when
the first real module needs them — never empty placeholders.**

## 1. Current structure (what exists)

```text
orbito/
├── apps/
│   ├── api/                          FastAPI service (Python 3.12, async)
│   │   ├── app/
│   │   │   ├── main.py               App factory, lifecycle
│   │   │   ├── config.py             Settings (env-driven, no hardcoding)
│   │   │   ├── logging.py
│   │   │   ├── seed.py
│   │   │   ├── api/
│   │   │   │   ├── sse.py            Server-Sent Events helpers
│   │   │   │   ├── schemas.py        Pydantic I/O contracts
│   │   │   │   └── v1/               health, chat, catalog, model_hub, system,
│   │   │   │                         workspaces, tasks, conversations, memory,
│   │   │   │                         scraping, files, intel, dashboard
│   │   │   ├── core/
│   │   │   │   ├── orchestrator/     runner.py — route → plan → tools → stream
│   │   │   │   ├── model_gateway/    registry, router, hub, pricing, schemas
│   │   │   │   │   └── providers/    ollama, openai, anthropic, google,
│   │   │   │   │                     mistral(openai-compat), mock
│   │   │   │   ├── system_center/    collector, processes, alerts
│   │   │   │   ├── system_monitor.py
│   │   │   │   ├── memory/           store.py (recall/capture/inspect)
│   │   │   │   ├── permissions/      policy.py
│   │   │   │   ├── task_controls.py  stop/cancel
│   │   │   │   └── workspace.py
│   │   │   ├── agents/               base.py, registry.py, specialists.py
│   │   │   ├── tools/                web_search, browser, documents,
│   │   │   │                         filesystem, scraping, net (SSRF guard)
│   │   │   ├── db/                   models.py, repositories.py, session.py
│   │   │   └── config/models.yaml    Role → provider/model mapping + fallbacks
│   │   └── tests/                    10 test modules + conftest
│   │
│   └── web/                          Next.js 16 (App Router, React 19, Tailwind v4)
│       └── src/
│           ├── app/                  / (dashboard), chat, agents, agents/monitor,
│           │                         scraping, system, news, crypto, knowledge,
│           │                         workspaces, voice, video, automations,
│           │                         activity, settings
│           ├── components/
│           │   ├── layout/           app shell, sidebar, topbar
│           │   ├── ui/               design-system primitives
│           │   ├── dashboard/        overview widgets: command-center,
│           │   │   └── overview/     system-status/health, active-agents,
│           │   │                     task-overview, model-hub-summary,
│           │   │                     pending-approvals, automation-overview,
│           │   │                     usage-overview, recent-activity,
│           │   │                     welcome-section, quick-access
│           │   ├── three/            orbital-scene (R3F + drei installed)
│           │   ├── charts/           Recharts wrappers
│           │   ├── chat/ agents/ news/ crypto/ system/ monitor/
│           │   ├── scraping/ settings/ workspaces/ activity/ brand/
│           ├── lib/                  api.ts (typed client + SSE parser),
│           │                         types.ts, types-system.ts, nav.ts,
│           │                         agents.ts, theme.ts, utils.ts
├── infrastructure/docker/            Container builds (Compose: Postgres+pgvector,
│                                     Redis, MinIO — provisioned, not yet run here)
├── docs/                             9 architecture docs + this planning set
├── scripts/dev.sh                    Dev launcher
├── .github/                          CI (lint, typecheck, tests, build)
├── docker-compose.yml
├── Makefile                          dev / api / web / test / build / db-up
├── pnpm-workspace.yaml               Monorepo (pnpm)
└── .env.example                      Complete, documented
```

Notable: `packages/` (shared ui/types/sdk) from the blueprint **does not exist
yet** — shared types currently live in `apps/web/src/lib/types.ts`. That is fine
for a single frontend; extract a package when a second consumer appears.

## 2. Import boundaries (enforced — see AGENTS.md)

```text
api → core → agents → tools
       ├──→ model_gateway   (only code allowed to call model APIs)
       └──→ db              (only code allowed to query the DB)
```

No circular imports; agents never import `api`; frontend never sees keys.

## 3. Target structure (blueprint, adapted — add incrementally)

```text
orbito/
├── apps/api/app/
│   ├── core/
│   │   ├── ai_core/            # Phase 3: intent, planner, recovery (evolves orchestrator/)
│   │   ├── approvals/          # Phase 1: durable approval queue + audit records
│   │   ├── embeddings/         # Phase 2: embed endpoint, chunking, pgvector retrieval
│   │   └── system_center/
│   │       ├── gpu.py          # AMD-aware GPU info (real VRAM, best-effort metrics)
│   │       ├── thermal.py      # Windows best-effort temps, honest N/A
│   │       └── history.py      # ring buffer + retention aggregation
│   └── modules/                # domain services as they grow:
│       ├── news/               # ingestion, dedupe, geo, categories (Phase 4+)
│       ├── careers/            # connectors, matching, applications (Phase 5)
│       ├── education/          # PDF pipeline, flashcards, study plans (Phase 5)
│       └── automations/        # workflow engine, triggers (Phase 4+)
├── workers/                    # Phase 2 — FIRST worker creates this folder
│   ├── agent_worker/           # long agent runs off the API process
│   ├── scraping_worker/        # Phase 4 crawl executor
│   ├── ingestion_worker/       # news/jobs pipelines
│   └── document_worker/        # PDF extraction + embeddings
├── packages/                   # only when a second consumer exists
│   ├── shared-types/           # extract from apps/web/src/lib/types.ts
│   └── api-client/             # typed client extraction
├── infrastructure/
│   ├── postgres/               # migration/backup scripts when Postgres is daily
│   └── monitoring/             # OTel collector config (Phase 7)
└── docs/
    ├── (existing 9 docs)
    ├── PROJECT_BREAKDOWN.md    # repo audit vs. blueprint
    ├── HARDWARE_OLLAMA.md      # this machine + local-model plan
    ├── FEATURES.md             # living status catalog
    ├── PROJECT_STRUCTURE.md    # this file
    └── IMPLEMENTATION_PLAN.md  # ordered backlog
```

Migration notes:

- `core/orchestrator/` is **not** replaced by `ai_core/`; it evolves into it
  (same contracts, LangGraph internals in Phase 3).
- `modules/*` start as Python packages inside the existing app — the modular
  monolith stays one process; only workers move out.
- The blueprint's `workers/` split is the Phase 2 boundary; `schedule_job` is
  already the seam callers use, so extraction is mechanical.
- Windows note: keep repo on E: only if acceptable; `node_modules`/`.venv` on
  the 320 GB HDD are slow. Models and databases belong on C: (NVMe) per
  [HARDWARE_OLLAMA.md](HARDWARE_OLLAMA.md).

## 4. Where each blueprint system lives

| Blueprint system | Backend home | Frontend home |
|---|---|---|
| Command Center | `api/v1/dashboard.py` | `app/page.tsx` + `components/dashboard/overview/*` |
| AI Core | `core/orchestrator` → `core/ai_core` | chat + agent monitor |
| Agent System | `agents/` | `app/agents/*` |
| Task Manager | `api/v1/tasks.py`, `core/task_controls.py` | tasks views + SSE |
| Model Hub | `core/model_gateway/hub.py`, `api/v1/model_hub.py` | `app/settings` (Model Hub) |
| News / Planet | future `modules/news` | `app/news`, `components/three` |
| Jobs | future `modules/careers` | new `app/jobs` |
| Education | future `modules/education` | `app/knowledge`, new `app/academy` |
| Knowledge/Memory | `core/memory`, future `core/embeddings` | settings → memory, knowledge |
| Web Intelligence | `tools/scraping.py`, `api/v1/scraping.py` | `app/scraping` |
| Voice & Media | future media worker | `app/voice`, `app/video` |
| Automation | future `modules/automations` | `app/automations` |
| System Center | `core/system_center`, `api/v1/system.py` | `app/system` |
| Security | `core/permissions`, future `core/approvals` | settings + security views |
| Observability | activity/usage endpoints | `app/activity` |
