# ORBITO — Implementation Plan (What To Build Next)

Ordered backlog derived from [PROJECT_BREAKDOWN.md](PROJECT_BREAKDOWN.md) and
adapted to this machine ([HARDWARE_OLLAMA.md](HARDWARE_OLLAMA.md)). It refines
[ROADMAP.md](ROADMAP.md) with concrete, checkable work items. Each phase keeps
`make dev` working and ships tests + docs (AGENTS.md definition of done).

Status: ⬜ todo · 🔄 in progress · ✅ done

---

## Phase 0 — Make this machine real (hours, not days) ⬜

The gateway currently falls back to `mock` here because no models are pulled.

- [ ] Pull models: `qwen3.5:4b`, `qwen3.5:9b`, `qwen2.5-coder:7b`,
      `nomic-embed-text` (all stored on C: NVMe by default).
- [ ] Set Ollama service env: `OLLAMA_KEEP_ALIVE=10m`,
      `OLLAMA_MAX_LOADED_MODELS=2`, `OLLAMA_NUM_PARALLEL=1`.
- [ ] Add role overrides to `.env` per HARDWARE_OLLAMA §5; verify chat streams
      from `qwen3.5:4b` (model badge + `model_usage` row, not mock).
- [ ] Optional one-off: test `OLLAMA_VULKAN=1` with the RX 5700 XT; keep only if
      stable and faster; record result in HARDWARE_OLLAMA.
- [ ] Windows honesty pass in System Center:
  - battery → `null` + UI "Not available" (desktop has none);
  - CPU temp → best-effort, else N/A (no fabricated values);
  - GPU → report RX 5700 XT with real 8 GB VRAM (fix WMI 4 GB cap),
    utilization best-effort;
  - process terminate → `psutil.terminate()/kill()` semantics + protected-PID
    blocklist.
- [ ] Decide repo location: keep on E: (slow HDD) or move to C: NVMe. Models,
      SQLite/Postgres data and media always on C:.
- [ ] Document Windows dev flow in DEVELOPMENT.md (make alternatives, venv,
      Docker Desktop + WSL2 for `make db-up`).

**Done when:** a chat answer on this PC is generated locally by Ollama, and the
System page shows only real, measured values for this desktop.

## Phase 1 — Auth, approvals, audit (blueprint's "security from day one") ⬜

- [ ] Sessions + login/logout (Better Auth or equivalent); replace
      `DEMO_USER_ID` everywhere; workspace scoping middleware.
- [ ] Durable **approval queue**: `approvals` table, risk levels (low/medium/
      high/critical), request → pending → approved/rejected with audit records.
      Wire `core/permissions/policy.py` into the orchestrator so `approval`
      tools actually pause a task (`waiting_approval` state).
- [ ] Pending-approvals dashboard widget connected to the real queue (component
      exists: `dashboard/overview/pending-approvals.tsx`).
- [ ] Encrypted provider credentials at rest; log redaction pass; audit log
      endpoint + minimal UI.
- [ ] Data-health indicator: extend `/health` with per-source status
      (db, redis, ollama, workers) + global badge in the topbar.

**Done when:** two users cannot see each other's data, and a tool marked
`approval` cannot run without a recorded user decision.

## Phase 2 — Durable execution + retrieval ⬜

- [ ] `workers/agent_worker` (Redis + ARQ or Celery): move long runs off the
      API process via the existing `schedule_job` seam; task survives restart.
- [ ] Task lifecycle completion: pause/resume, retry policy, priorities,
      concurrency limits (tuned for 16-thread CPU: e.g. 1 heavy inference +
      2 light jobs), dead-letter for poison tasks.
- [ ] Replace polling with Redis pub-sub → WebSocket/SSE task events.
- [ ] Embeddings: gateway `embed` capability → `nomic-embed-text`;
      document ingestion → chunk → pgvector; run Postgres via Compose
      (Docker Desktop/WSL2) and migrate off SQLite.
- [ ] Telemetry history: in-memory ring (raw 24 h) + 1-min/15-min aggregates
      with retention; charts get real time ranges.
- [ ] AI Resource Monitor: correlate Ollama loaded models (hub API/`ollama ps`)
      with collector RAM; show per-model memory + inference activity; recommend
      (never auto-kill) unloads above 90% RAM.
- [ ] Gateway budgets + per-request token caps + backoff retries.

**Done when:** a scrape or agent run continues after an API restart, and
document Q&A retrieves from pgvector.

## Phase 3 — Agent platform depth ⬜

- [ ] LangGraph `StateGraph` inside the orchestrator (same contracts);
      checkpointing = real pause/resume.
- [ ] Sub-agents: parent/child task rows, independent traces, tree view in
      Agent Monitor.
- [ ] Model-assisted intent classifier behind `AgentRegistry.select`
      (deterministic scoring stays as fallback; run it on `fast` local role).
- [ ] Custom agent builder (identity, instructions, model role, tools,
      approvals, limits) persisted as `agent_definitions`.
- [ ] Workspace-scoped memory + vector retrieval with citations; memory access
      controls per agent; memory inspector UI upgrades.

**Done when:** a user-defined agent with a sub-agent executes a multi-step plan
that pauses for approval and resumes exactly once.

## Phase 4 — Web intelligence at scale + News pipeline ⬜

- [ ] `workers/scraping_worker`: Playwright rendering, per-domain rate limits,
      retries, sitemap discovery, incremental + scheduled crawls, extraction
      validation, dedupe, Excel export.
- [ ] News ingestion (`modules/news`): RSS-first sources, content extraction,
      dedupe, category classification (local `fast` role), AI summaries,
      entity extraction; geo only when evidence-backed — confirmed vs. inferred
      vs. unknown flags.
- [ ] **Planet globe**: reuse installed R3F/drei (`components/three/`) — render
      only real geolocated events from the pipeline; clusters + filters +
      article drawer. RX 5700 XT handles WebGL comfortably.
- [ ] Watchlists, topics pages, daily briefing generation.

**Done when:** 1,000-page crawl job runs unattended with progress + clean
export, and the globe shows only real, sourced events.

## Phase 5 — Career & Education ⬜

- [ ] Job connectors (Greenhouse, Lever, Ashby, career pages) on the generic
      scraping engine; normalize → dedupe → jobs DB; scheduled discovery.
- [ ] CV upload/parse → structured candidate profile; local-model match
      scoring; gap analysis; tailored CV/cover-letter drafts.
- [ ] Application Kanban (discovered → … → offer/rejected) with
      approval-gated submission (never auto-submit).
- [ ] Education: PDF → PyMuPDF extraction → chunks → pgvector; source-grounded
      chat with page-level citations; summaries, flashcards, quizzes, study
      plans with real progress evidence.

**Done when:** a scored job shortlist + reviewable application draft, and a
cited answer from an uploaded PDF.

## Phase 6 — Automation, voice, video ⬜

- [ ] Workflow engine: triggers (cron/event/webhook), conditions, actions;
      React Flow builder; versioned executions + failure notifications.
- [ ] Voice: STT (local Whisper-small viable on this CPU) + TTS abstraction;
      LiveKit optional (cloud); voice commands through the orchestrator.
- [ ] Video: FFmpeg → audio → transcript → frame analysis → Q&A; generation
      stays cloud-only on this hardware.

## Phase 7 — Hardening & production ⬜

- [ ] OpenTelemetry traces across API/worker/gateway (env already templated).
- [ ] Rate limiting, CSRF, secure cookies, dependency scanning, backups +
      restore drills, security review.
- [ ] Billing/quotas only if multi-user becomes real.

---

## Hardware guardrails (apply to every phase)

1. **One heavy local generation at a time** (`OLLAMA_NUM_PARALLEL=1`); queue
   everything else.
2. **Max 2 loaded models** (~9 GB of the 16 GB model budget); embeddings model
   counts as one.
3. Keep `OLLAMA_CONTEXT_LENGTH=8192`; raise per-task only when needed and
   show the memory cost in the UI.
4. `OLLAMA_THINK=false` by default; enable per request for hard reasoning
   (3× latency on CPU).
5. RAM ≥ 90% → scheduler defers new inference; ≥ 96% → recommend unloading
   (user-confirmed only).
6. All models/DB/media on C: NVMe; D: for backups/exports; E: code-only.
7. Never fabricate a metric this machine cannot measure (battery, temps, AMD
   utilization) — render "Not available".

## Suggested first sprint (one week)

1. Phase 0 entirely (models pulled, Windows honesty pass). 
2. Phase 1: auth sessions + approval queue table/API.
3. Approvals widget wired to real data.
4. Data-health indicator in topbar.

That sequence turns ORBITO from "demo that runs on mock" into "real local AI OS
with a security spine" — everything after it stacks on top.
