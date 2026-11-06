# Database

PostgreSQL (with pgvector) is the production source of truth. SQLite is the
zero-setup development default so `make dev` works on a clean machine.

```env
# development
DATABASE_URL=sqlite+aiosqlite:///./.data/orbito.db

# docker / production
DATABASE_URL=postgresql+asyncpg://orbito:orbito@localhost:5432/orbito
```

SQLite runs in WAL mode with a busy timeout and foreign keys enabled. Schema is
created with SQLAlchemy `create_all` in Foundation v0.1; Alembic migrations are
the next step before multi-version production use.

## Ownership rule

Every user-owned row has `user_id`. IDs are UUIDv4 strings. Timestamps are
UTC. Server-enforced ownership checks (and PostgreSQL RLS) arrive with auth in
Phase 1 — until then this build is a local demo workspace only.

## Tables

| Group | Tables | Purpose |
|---|---|---|
| Identity | `users`, `profiles` | account, plan, preferences |
| Conversation | `conversations`, `messages` | chat threads, model metadata, token counts |
| Agents | `agents` | user-level agent configuration/enablement |
| Execution | `tasks`, `task_steps` | every run, plan, status, result, cost |
| Models | `model_providers`, `model_usage` | provider config refs, tokens/cost ledger |
| Memory | `memories` | long-term/workspace facts with scope |
| Files | `files`, `documents`, `embeddings` | metadata, extracted docs, vectors |
| Automation | `workflows`, `workflow_runs` | definitions and run history |
| Scraping | `scraping_jobs`, `scraping_results` | configs, progress, structured rows |
| Career | `job_applications` | tracker state and match scores |
| System | `notifications`, `audit_logs` | user notices, sensitive action history |

## Relationships

```text
User
 ├─ Conversations ── Messages
 ├─ Tasks ────────── TaskSteps
 ├─ Memories
 ├─ Files ────────── Documents ── Embeddings
 ├─ Workflows ────── WorkflowRuns
 ├─ ScrapingJobs ─── ScrapingResults
 ├─ JobApplications
 └─ ModelUsage

Conversation ── Tasks (optional link)
Task ────────── ModelUsage (cost attribution)
```

## Conventions

- UUID string primary keys (`String(36)`).
- `created_at` / `updated_at` on mutable domain tables.
- JSON columns for flexible metadata (`meta`, `config`, `preferences`).
- `schema` is reserved-adjacent in SQLAlchemy, so scraping jobs map
  `schema_` → column name `schema`.
- Soft deletion only where the product needs it (`conversations.archived`).
  Files/memory deletion is explicit.

## Vector search

`embeddings` currently stores vectors as JSON. Once the ingestion pipeline
ships, migrate to pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE embeddings ADD COLUMN vector vector(1536);
CREATE INDEX ON embeddings USING hnsw (vector vector_cosine_ops);
```

SQLite dev can keep JSON + cosine in Python; production uses pgvector.

## Migrations

```bash
cd apps/api
.venv/bin/alembic init migrations        # first time
.venv/bin/alembic revision --autogenerate -m "add x"
.venv/bin/alembic upgrade head
```

Until Alembic is wired, delete `.data/orbito.db` to recreate a development
schema. Never do that against production data.

## Backup strategy (planned)

Daily managed-Postgres snapshots, 7-day retention; object storage lifecycle
rules for uploads; restore drill documented in `docs/ROADMAP.md`.
