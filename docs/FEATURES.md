# ORBITO — Feature Catalog & Status

Living document. Every feature is marked against the **actual repo state**
(verified 2026-11-08), not intentions. Update in the same commit as the feature.

Status: ✅ shipped · 🟡 foundation exists, incomplete · ⬜ not started ·
🔒 requires approval-gate/security work first · 🚫 prohibited by design

---

## Product priority: Personal Jarvis

The target is one local-first assistant on the owner's Windows PC. The central
loop is text/voice input → understanding → typed tool proposal → server-side
permission/approval → native PC action → truthful report. Read
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for the build sequence.

| Capability | Current status | Next gate |
|---|---|---|
| Local Ollama Model Hub / chat | ✅ | Verify Ollama provider/model in task trace for each runtime setup; health alone is insufficient |
| Windows PC control | ⬜ | No native PC tools yet; implement approval spine before state-changing actions |
| Enforced approvals | ⬜ | Policy metadata exists, but durable queue/final execution gate is incomplete |
| General model tool calling | ⬜ | Current routing is keyword + agent gather; typed proposal loop is not implemented |
| Push-to-talk / local STT/TTS | ⬜ | `/voice` is a UI shell only |
| User-controlled memory | 🟡 | CRUD and prompt recall exist; embeddings/RAG do not |
| Proactive workflows | ⬜ | No durable scheduler/worker or approval-aware scheduler |

Screenshots, clipboard and microphone are sensitive opt-in capabilities. No
arbitrary model-generated shell is allowed on the host. PC control remains
loopback-only and native on Windows by default.

---

## 01 · Command Center (dashboard, chat)

| Feature | Status | Notes / what to implement |
|---|---|---|
| Dashboard shell + welcome + quick actions | ✅ | `apps/web/src/app/page.tsx` |
| Chat with streaming, stop, sources, usage | ✅ | SSE timeline, per-message model + cost |
| Aggregated dashboard API | 🟡 | `/dashboard/overview` exists; add approvals, automations, model-hub and system-health sections into one payload |
| Pending approvals widget | ⬜🔒 | Needs the approval queue (Phase 1/3) |
| Intelligence feed (news/jobs/research) | ⬜ | Needs ingestion pipelines (06/07) |
| Personal Briefing (morning digest) | ⬜ | Automation + agent output; after Phase 2 scheduler |
| Dashboard customization (hide/reorder widgets) | ⬜ | Persist layout per user — needs auth |
| Data-health indicator (connected/stale/offline per source) | ⬜ | Cheap to add on top of `/health`; high value for the "never fake data" rule |

## 02 · AI Core (orchestration)

| Feature | Status | Notes |
|---|---|---|
| Deterministic orchestrator (route → plan → tools → stream → persist) | ✅ | `core/orchestrator/runner.py`, tested |
| Keyword-based agent routing | ✅ | Inspectable by design |
| Model role resolution + fallback chains + mock terminal | ✅ | `core/model_gateway` |
| Cost accounting per task | ✅ | `pricing.py` + `model_usage` |
| Intent classification (model-assisted) | ⬜ | Replace `AgentRegistry.select` behind the same contract |
| Task decomposition (multi-step plans across agents) | ⬜ | Phase 3, LangGraph `StateGraph` + checkpointing |
| Budgets / deadlines / retry with backoff | ⬜ | Phase 2 gateway work |
| Recovery engine (resume after restart) | ⬜ | Needs durable workers (Phase 2) |

## 03 · Agent System

| Feature | Status | Notes |
|---|---|---|
| 6 declarative agents (core, career, research, study, coding, automation) | ✅ | Contract in `agents/base.py`, docs in AGENTS.md |
| Agent Monitor page + agent detail | ✅ | `agents/monitor` route |
| Per-agent stats (success rate, tokens, avg duration) | ⬜ | Data exists in tasks/usage; needs aggregation + UI |
| Sub-agents with parent-child executions | ⬜ | Phase 3; tasks already have IDs for hierarchy |
| Custom agent builder (user-defined agents) | ⬜ | Phase 3 |
| Agent sandbox/testing | ⬜ | After builder |

## 04 · Task Manager

| Feature | Status | Notes |
|---|---|---|
| Task rows + step timeline persisted before streaming | ✅ | `tasks` / `task_steps` |
| Live task events over SSE | ✅ | `step.updated`, `task.created` |
| Stop/cancel running task | ✅ | `core/task_controls.py` |
| Pause/resume end-to-end | 🟡 | Controls partial; needs durable state |
| Background workers (Redis + ARQ/Celery) | ⬜ | Phase 2 — unlock for everything scheduled |
| Priorities, dependencies, concurrency limits | ⬜ | Phase 2; resource-aware on this 32 GB machine |
| Retry policy + dead-letter queue | ⬜ | Phase 2 |
| Scheduled tasks | ⬜ | Phase 2 |

## 05 · Model Hub

| Feature | Status | Notes |
|---|---|---|
| Provider adapters: Ollama, OpenAI, Anthropic, Google, Mistral, mock | ✅ | One file per provider, registered once |
| Installed/running model discovery | ✅ | `/model-hub/overview` |
| Pull with SSE download progress + delete | ✅ | Name-validated, streams percent |
| Hardware summary endpoint | ✅ | Needs VRAM/battery honesty fixes for this PC (HARDWARE_OLLAMA §8) |
| Model testing (try-it panel) | ⬜ | Small: route a one-shot generation |
| Capability routing UI (assign models per role) | ⬜ | Env overrides work today; UI writes config |
| Embeddings endpoint + embed model role | ⬜ | Phase 2; `nomic-embed-text` per hardware doc |
| Cloud credential vault (encrypted at rest) | ⬜🔒 | Phase 1 |

## 06 · News Intelligence + Planet

| Feature | Status | Notes |
|---|---|---|
| `intel` API + news page | 🟡 | RSS feeds and source health; ingestion is still request/cache based, not a durable pipeline |
| RSS/feed ingestion worker | ⬜ | Phase 2 worker + scheduler; respect robots.txt/rate limits |
| Dedupe, entity + category extraction, AI summaries | ⬜ | Use `fast`/`reasoning` local roles |
| Geo-extraction with confirmed vs. inferred locations | 🟡 | Headline gazetteer matches and approximate publisher-region fallback are labeled; not true event geocoding |
| 3D Planet (Three.js/R3F globe with news) | 🟡 | Local 4K Earth textures, live RSS headlines, approximate source/headline markers and Wikipedia point descriptions; no global event pipeline |
| Topics, watchlists, daily briefing | ⬜ | After ingestion |

## 07 · Jobs Intelligence (Career)

| Feature | Status | Notes |
|---|---|---|
| Career agent with approval gates (submit application, send email) | ✅ | Advisory today; enforcement needs the approval queue 🔒 |
| Job discovery connectors (Greenhouse/Lever/Ashby/career pages) | ⬜ | Connector architecture on top of the scraping engine |
| Jobs DB lifecycle (normalize → dedupe → store) | 🟡 | Schema exists (`jobs`, `job_matches`); pipeline missing |
| AI match scoring vs. candidate profile | ⬜ | Needs CV parse (Phase 5) |
| Application Kanban + tracker | ⬜ | Phase 5 |
| CV versions, cover letters, tailored documents | ⬜ | Phase 5; generation is local-model friendly |

## 08 · Education Center (Academy)

| Feature | Status | Notes |
|---|---|---|
| Study agent (documents tool) | ✅ | |
| Knowledge page shell | 🟡 | |
| PDF ingestion → chunk → embed → pgvector | ⬜ | Phase 2/5; PyMuPDF + Ollama embeddings |
| Source-grounded chat with page citations | ⬜ | RAG over pgvector |
| Flashcards, quizzes, study plans, progress | ⬜ | Phase 5 |
| Audio summaries | ⬜ | Needs TTS (Phase 6) |

## 09 · Knowledge & Memory

| Feature | Status | Notes |
|---|---|---|
| Recall / explicit capture ("remember …") / inspect / delete | ✅ | `core/memory/store.py` + `/memory`; bounded memories are injected into prompts |
| Last-14-message conversation context | ✅ | |
| Workspace-scoped memory | 🟡 | Scope/workspace fields and workspace-filtered recall exist; confirm association through the UI/API |
| Semantic (vector) retrieval with citations | ⬜ | Phase 2/3 |
| 4-type memory architecture (working/episodic/semantic/procedural) | ⬜ | Design after vector retrieval lands |
| Memory access controls per agent | ⬜🔒 | Phase 3 |

## 10 · Web Intelligence (Scraping Studio)

| Feature | Status | Notes |
|---|---|---|
| Scraping jobs: HTTP fetch, CSS-schema extraction, depth crawl | ✅ | `tools/scraping.py`, `/scraping` API + UI |
| CSV/JSON export | ✅ | |
| SSRF guard on all fetches | ✅ | `tools/net.py` |
| Concurrency + max pages + domain allowlist env limits | ✅ | `.env.example` |
| Playwright JS rendering | ⬜ | Phase 4 |
| Scheduling + incremental crawls | ⬜ | Needs workers |
| Extraction validation + dedupe | ⬜ | Phase 4 |
| Excel export, sitemap discovery, crawl history UI | ⬜ | Phase 4 |
| Scraping worker isolation + per-domain rate limits | ⬜ | Phase 4 |

## 11 · Voice & Media

| Feature | Status | Notes |
|---|---|---|
| Voice/Video page shells | 🟡 | UI only |
| STT (Whisper) / TTS (Piper or cloud) | ⬜ | Phase 6; local Whisper-small is viable on this CPU |
| LiveKit real-time voice | ⬜ | Env keys already templated |
| FFmpeg video pipeline (transcribe → frames → Q&A) | ⬜ | Phase 6 |
| Image/video generation via gateway | ⬜ | Cloud providers only on this hardware |

## 12 · Automation Center

| Feature | Status | Notes |
|---|---|---|
| Automation agent (workflow drafting) | ✅ | Produces plans, cannot execute schedules yet |
| Workflow engine + triggers (time/event/webhook) | ⬜ | Phase 2 workers first |
| Visual builder (React Flow) | ⬜ | After engine |
| Execution history + failure notifications | ⬜ | After engine |

## 13 · System Center

| Feature | Status | Notes |
|---|---|---|
| Live CPU/RAM/disk/swap collector + UI | ✅ | `core/system_center/collector.py`, `/system` page |
| Threshold alerts (warn/critical, env-configured) | ✅ | `alerts.py` |
| Process list + details | ✅ | `processes.py` |
| Process termination (guarded) | 🟡 | Windows semantics: `terminate()/kill()`, protected-process blocklist |
| Battery | N/A on this desktop | Must render "Not available" — never fake |
| CPU/GPU temperature | 🟡 | Best-effort on Windows; optional LibreHardwareMonitor/WMI source; otherwise N/A |
| AMD GPU info (RX 5700 XT, 8 GB real VRAM) | 🟡 | Fix WMI 4 GB cap; live utilization best-effort |
| History storage + retention (raw 24h / 1-min 7d / 15-min 30d) | ⬜ | In-memory ring today |
| AI Resource Monitor (Ollama loaded models, per-model RAM, tok/s, downloads) | ⬜ | Data available from `/model-hub` + `ollama ps`; correlate with collector |
| Resource-aware model manager (unload under pressure) | ⬜ | Recommend-only by default; never auto-kill processes |

## 14 · Security Center

| Feature | Status | Notes |
|---|---|---|
| Tool permission levels (auto/approval/restricted) | ✅ | Declared in registry |
| Permission policy module | 🟡 | `core/permissions/policy.py` scaffolding |
| Auth (sessions, login, per-user data) | ⬜🔒 | Deferred for single-user local-first target; required before remote/multi-user exposure |
| Durable approval queue + enforced execution + audit | ⬜🔒 | First safety phase before PC state-changing tools; current policy flags alone do not enforce it |
| Encrypted credential storage + redaction | ⬜🔒 | Phase 1 |
| Audit log UI | ⬜ | After audit records exist |
| Prompt-injection defenses (untrusted content tagging) | 🟡 | Tool output truncated/marked; formalize in prompt builder |
| Rate limiting, CSRF, secure cookies | ⬜ | Phase 7 (single-user LAN dev can defer, document it) |

## 15 · Observability

| Feature | Status | Notes |
|---|---|---|
| Activity log + usage/cost views | ✅ | `activity` route |
| Per-task trace tree (agent → tools → model) | 🟡 | Steps exist; add parent/child tree view |
| OpenTelemetry across API/worker/provider | ⬜ | Env var already templated; Phase 7 |
| Provider health/latency tracking | ⬜ | Gateway emits events; needs aggregation |

## Cross-cutting

| Feature | Status | Notes |
|---|---|---|
| Real-data rules (no fabricated metrics anywhere) | ✅ policy | Enforced in review; add data-health indicator |
| Windows dev ergonomics (make on Windows, venv, Docker Desktop) | 🟡 | Document in DEVELOPMENT.md; WSL2 optional |
| CI (lint, typecheck, tests, build) | ✅ | GitHub Actions |

## PC Control (planned; no desktop tools currently registered)

| Feature | Status | Notes |
|---|---|---|
| Read Windows system status | 🟡 | Existing System Center is partial; Windows-specific gaps remain |
| Search PC files | ⬜ | Bounded to explicitly configured roots; must exclude secrets and prevent reparse-point escapes |
| Launch allowlisted apps / open validated URLs | ⬜ | Named app IDs only, no arbitrary executable paths |
| Volume and media controls | ⬜ | Windows adapter and bounded actions |
| Screenshot / clipboard | ⬜ | Opt-in, explicit request, local-only and no retention by default |
| Write/move/delete, close app, keyboard/mouse | ⬜🔒 | Blocked until one-time payload-bound approval is enforced |
| Arbitrary host shell | 🚫 | Prohibited; never run model-generated shell/PowerShell/CMD/Python |
