# ORBITO — Project Breakdown & Gap Analysis

**Date:** 2026-11-07 · **Repo state:** Foundation v0.1 (runnable, tested, CI green)
**Machine:** Windows 11 desktop, Ryzen 7 5700X, 32 GB RAM, RX 5700 XT — see
[HARDWARE_OLLAMA.md](HARDWARE_OLLAMA.md).

This document audits what the repository **actually contains today** and maps it
against the 15-system ORBITO blueprint. Companion docs:

- [FEATURES.md](FEATURES.md) — feature-by-feature status catalog.
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — current vs. target structure.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — what to build next, in order.
- [ROADMAP.md](ROADMAP.md) — the original phase plan (still valid; the
  implementation plan adapts it to this machine).

---

## 1. What exists today (verified in code)

### Backend — `apps/api` (FastAPI, modular monolith)

| Area | Location | State |
|---|---|---|
| API composition (13 domains under `/api/v1`) | `app/api/v1/router.py` | ✅ health, chat, catalog, model-hub, system, workspaces, tasks, conversations, memory, scraping, files, intel, dashboard |
| SSE streaming | `app/api/sse.py` | ✅ token + step events |
| Model gateway (5 providers + mock) | `app/core/model_gateway/` | ✅ Ollama, OpenAI, Anthropic, Google, Mistral, mock; role resolution, fallback chains, cost accounting (`pricing.py`), hub lifecycle (`hub.py`) |
| Orchestrator | `app/core/orchestrator/runner.py` | ✅ deterministic route → plan → tools → stream → persist |
| Agent registry | `app/agents/` | ✅ core, career, research, study, coding, automation (declarative contracts) |
| Tool registry | `app/tools/` | ✅ web_search, browser, documents, filesystem, scraping, net (SSRF guard) |
| System Center | `app/core/system_center/` + `system_monitor.py` | ✅ collector, processes, threshold alerts |
| Memory | `app/core/memory/store.py` | ✅ basic recall / capture / inspect / delete |
| Permissions | `app/core/permissions/policy.py` | ⚠️ policy scaffolding only — no enforcement loop, no approval queue |
| Task controls | `app/core/task_controls.py` | ✅ stop/cancel; pause/resume partial |
| Persistence | `app/db/` (SQLAlchemy) | ✅ full domain schema; SQLite default, Postgres/pgvector via Compose (not yet run here) |
| Tests | `apps/api/tests/` | ✅ 10 test modules (gateway, orchestrator, model hub, system monitor/center, intel, tasks, workspaces, api) |

### Frontend — `apps/web` (Next.js 16, App Router, Tailwind v4)

15 routes exist: `/` (dashboard), `chat`, `agents`, `agents/monitor`,
`scraping`, `system`, `news`, `crypto`, `knowledge`, `workspaces`, `voice`,
`video`, `automations`, `activity`, `settings`.
Typed API client + SSE parser (`src/lib/api.ts`), design tokens
(`globals.css`), nav config (`lib/nav.ts`), agent fallbacks (`lib/agents.ts`).

### Infrastructure

- `docker-compose.yml` — Postgres+pgvector, Redis, MinIO (provisioned, not yet
  exercised on this machine).
- `Makefile` — `dev`, `api`, `web`, `test`, `build`, `db-up`.
- GitHub Actions CI. `.env.example` complete.
- Docs: ARCHITECTURE, API, MODELS, AGENTS, DATABASE, SECURITY, ROADMAP,
  DEVELOPMENT, ORBITO_MASTER_ARCHITECTURE.

---

## 2. Blueprint mapping — 15 systems vs. reality

Status legend: ✅ done · 🟡 partial/foundation · ⬜ not started

| # | Blueprint system | Repo reality | Status | Biggest gap |
|---|---|---|---|---|
| 01 | Command Center | Dashboard page + chat with live execution trace | 🟡 | Aggregated `/dashboard/overview` exists but widgets (approvals, automations, briefing) are thin |
| 02 | AI Core | Deterministic orchestrator + gateway | 🟡 | No intent classifier (keyword scoring only), no planner decomposition, no recovery engine |
| 03 | Agent System | 6 declarative agents in one registry | 🟡 | No sub-agents, no custom agent builder, no per-agent execution history/stats |
| 04 | Task Manager | Task rows + SSE steps + stop control | 🟡 | No queue/workers (in-process only), no pause/resume end-to-end, no retry policy, no dead-letter |
| 05 | Model Hub | Full: discovery, pull (SSE progress), delete, hardware, running models | ✅ | Missing: embeddings role wired to a real embed model, model routing UI per capability |
| 06 | News Intelligence | `intel` API + `news` page | 🟡 | No ingestion pipeline (RSS/scheduler), no geo-extraction, **no 3D Planet** |
| 07 | Jobs Intelligence | Career agent + intel endpoints | 🟡 | No job connectors (Greenhouse/Lever/Ashby), no jobs DB lifecycle, no match scoring, no Kanban application tracker |
| 08 | Education Center | Study agent + knowledge page | ⬜ | No PDF→chunk→embed→RAG pipeline, no citations, no flashcards/quizzes/study plans |
| 09 | Knowledge Intelligence | Simple memory store | 🟡 | No pgvector retrieval, no collections, no document versioning, no knowledge graph |
| 10 | Web Intelligence | Scraping engine: HTTP fetch, CSS schemas, depth crawl, CSV/JSON export, SSRF guard | 🟡 | No Playwright rendering, no schedules, no dedupe, no worker isolation |
| 11 | Voice & Media | `voice`/`video` pages only | ⬜ | No STT/TTS, no Whisper, no FFmpeg pipeline |
| 12 | Automation Center | Automation agent + page | ⬜ | No workflow engine, no triggers/scheduler, no React Flow builder |
| 13 | System Center | Collector, processes, alerts, live UI | 🟡 | **Windows adaptation needed** (no battery, limited temps, AMD GPU); no history aggregation/retention; no AI Resource Monitor (Ollama per-model RAM) |
| 14 | Memory System | Recall/capture/inspect/delete | 🟡 | No 4-type memory architecture, no workspace scoping, no access controls |
| 15 | Security Center | Permission policy file, approval flags on tools | ⬜ | **No auth** (DEMO_USER_ID), no approval queue, no secrets encryption, no audit log UI |
| +  | Observability | Activity log + usage/cost | 🟡 | No execution tracing tree, no OTel, no data-health indicator |

---

## 3. Critical gaps (blocking the blueprint's promises)

Ordered by how much everything else depends on them:

1. **Authentication & ownership (Phase 1).** Everything is single demo user.
   Without sessions there is no per-user data, no real permissions, no safe
   approval gates. This is the blueprint's "security from day one" rule and the
   repo's own next phase.
2. **Background execution (Phase 2).** Tasks run inside the API process. A
   restart kills running work; scraping/ingestion/crawls cannot be scheduled.
   Redis is already in Compose; an ARQ/Celery worker + durable task states are
   the unlock for News, Jobs, Education and Automation systems.
3. **Approval queue + audit log.** Tools already declare `approval`/
   `restricted` levels and agents list approval gates, but nothing enforces or
   records them. The blueprint treats this as non-negotiable before any
   autonomous action (job applications, emails, deletions).
4. **Embeddings + pgvector retrieval.** The database schema and Compose service
   exist; no ingestion pipeline uses them yet. Blocks Education (citations),
   Knowledge (semantic search) and better memory.
5. **Local models are not pulled.** Ollama 0.40.15 is installed with **zero
   models** — the gateway currently falls back to `mock` on this machine. See
   [HARDWARE_OLLAMA.md](HARDWARE_OLLAMA.md) for the exact pull list.
6. **Windows reality vs. Linux assumptions.** Docs and alert defaults assume a
   Linux laptop (battery, systemd, thermal zones). This machine is a Windows
   desktop: no battery, different thermal access, AMD GPU. System Center must
   degrade honestly ("Not available") — which the repo's real-data rules
   already demand.

## 4. What is intentionally NOT built yet

- 3D Planet (Three.js globe) — needs the news pipeline first, or it violates
  the "never invent data" rule.
- LangGraph migration — current runner maps cleanly to a `StateGraph` later;
  no reason to swap before Phase 3.
- Voice/video, billing, multi-tenancy, OTel — Phases 6–7.
- `workers/`, `packages/api-client`, `packages/agent-sdk` folders from the
  blueprint's target structure — create them when the first worker/package is
  real, not before (blueprint's own rule: no empty folders).

## 5. Honest assessment

The foundation is **better than most starting points**: the model gateway,
orchestrator loop, SSE trace, scraping engine and system monitor are real,
tested code — not mockups. The architecture docs match the code. The gap to the
full blueprint is mostly **depth (workers, auth, RAG, approvals)** and **the
intelligence modules (news, jobs, education, automation)**, in that order.
Build order matters more than breadth: Phases 1–3 in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) unlock everything after them.
