# Roadmap

Philosophy: ship a runnable, honest foundation, then add capability. Each phase
keeps `make dev` working and adds tests.

## Foundation v0.1 — current

**Goal:** the complete product loop on one machine.

| Deliverable | Status |
|---|---|
| Monorepo + docs + env template | ✅ |
| Next.js dashboard with ORBITO design system | ✅ |
| FastAPI service + versioned API | ✅ |
| SQLAlchemy schema for the full domain | ✅ |
| SQLite dev DB, Postgres/pgvector Compose service | ✅ (Compose not yet run in this environment) |
| Model gateway: 5 providers + offline mock, fallbacks, cost | ✅ |
| Orchestrator: routing, plan, tools, streaming, persistence | ✅ |
| Agent registry: core, career, research, study, coding, automation | ✅ |
| Tools: search, browser, documents, filesystem + SSRF guard | ✅ |
| Chat with live execution timeline, stop, sources, usage | ✅ |
| Scraping Studio: jobs, CSS schemas, depth crawl, CSV/JSON export | ✅ |
| Memory: recall, explicit capture, inspect/delete | ✅ |
| Activity log + usage/cost view | ✅ |
| Automated tests (9) + lint/typecheck/build | ✅ |
| GitHub Actions CI | ✅ |
| Authentication + per-user data | ⏳ Phase 1 |
| Redis-backed workers/queues | ⏳ Phase 2 |
| Docker images verified end-to-end | ⏳ Phase 0.2 |

**Definition of done:** a user can open the dashboard, send a prompt, watch a
plan execute, read a grounded answer, inspect the task and its cost, and export
scraped data — with or without provider keys.

## Phase 1 — Accounts & ownership

- Better Auth (or equivalent) sessions; login/logout/registration.
- Replace `DEMO_USER_ID` with the session user everywhere.
- Workspace scoping middleware; PostgreSQL RLS policies.
- Per-user settings; encrypted provider credentials.
- Onboarding: connect a provider, pick default models.

**Done:** two users cannot see each other’s conversations, files or tasks.

## Phase 2 — Deeper brain

- Redis + Celery worker for long tasks and scheduled runs.
- WebSocket/Redis pub-sub task events (replace polling).
- Gateway budgets, retries with backoff, per-request token caps.
- Embeddings endpoint + document ingestion into pgvector.
- Vision input (images) through the gateway.
- Model comparison and cost guardrails in Settings.

**Done:** a task survives an API restart and resumes/records its final state.

## Phase 3 — Agent platform

- LangGraph `StateGraph` + checkpointing (same contracts as today’s runner).
- Durable approval queue with audit records.
- User-defined agents: instructions, tools, limits, knowledge sources.
- Workspace memory + retrieval with citations.
- Multi-agent handoff with hard step/budget/deadline limits.

**Done:** a task pauses for approval, survives reload, and resumes exactly once.

## Phase 4 — Research & scraping at scale

- Playwright rendering for JS-heavy sites.
- Sitemap discovery, scheduling, incremental crawls.
- Dedicated scraping worker + concurrency limits per domain.
- Extraction validation (required fields, types) and dedupe.
- Research reports with source tables and exports.

**Done:** 1,000-page job with progress, retries and clean export.

## Phase 5 — Career & Study

- CV upload/parse → structured profile.
- Job search adapters, match scoring, tailored CV/cover letter.
- Application tracker with approval-gated submission.
- PDF ingestion → summaries, quizzes, flashcards, study plans.
- Spaced-repetition review loop.

**Done:** a user gets a scored shortlist and a tailored, reviewable application.

## Phase 6 — Voice & video

- LiveKit agent worker; STT/TTS provider abstraction.
- Barge-in, turn detection, multilingual voices.
- Video upload → FFmpeg audio → transcript → frame analysis → Q&A.
- Image/video generation through the gateway.
- Media storage in R2/S3 with signed URLs.

**Done:** a spoken conversation triggers a tool and returns speech; a video
answers questions with timestamps.

## Phase 7 — Production

- Billing, quotas, usage dashboards and alerts.
- Rate limiting, abuse prevention, audit review UI.
- Sandboxed code execution service.
- OpenTelemetry traces across API/worker/provider.
- Deployment pipelines, staging, backups, restore drills.
- Security review and penetration test.

**Done:** staging → production promotion with rollback and on-call runbook.

## Explicit non-goals

- Bypassing logins, CAPTCHAs, paywalls or access controls.
- Running model-generated shell on the host.
- Letting a prompt be the security boundary.
- Microservices for their own sake.
