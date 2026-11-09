# Development

## Prerequisites

- Node.js 20+ and pnpm 9+ (`corepack enable`)
- Python 3.12+
- Docker (optional, for PostgreSQL/Redis/MinIO)
- Ollama (recommended for the local Jarvis path; cloud credentials are optional)
- Windows 11 for native PC-control development/acceptance (desktop-control tools
  are not implemented yet)

## First run

```bash
git clone <repo> orbito && cd orbito
cp .env.example .env
make install      # pnpm install + Python venv + pip requirements
make dev          # API :8000 + web :3000
```

Open http://localhost:3000. For the personal local-first path, start Ollama and
pull a configured model. Without a reachable/configured provider, the mock may
be selected as a fallback; inspect the task's resolved provider/model instead
of assuming local inference worked.

### Windows local Jarvis development

Run the API and web app as native processes in the logged-in Windows session.
This is required for future desktop actions. Do not run the desktop executor in
Docker or WSL. Docker Desktop/WSL2 may still be used for optional Postgres,
Redis or MinIO.

```powershell
# Terminal 1: API (from repo root)
cd apps\api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2: web app (from repo root)
pnpm --filter @orbito/web dev

# Terminal 3: Ollama (if not already running as a service)
ollama serve
ollama list
```

Open http://localhost:3000. Keep the API on `127.0.0.1`; never expose future
PC-control endpoints to LAN/tunnels without a separate security design. Restart
the API after backend changes unless it was deliberately started with a working
reload mode.

```bash
make api          # backend only
make web          # frontend only
make test         # pytest + typecheck + lint
make build        # production web build
make seed         # add demo memories
```

## Environment

Configuration is `pydantic-settings` in `apps/api/app/config.py`. Root `.env` is
loaded automatically. Important values:

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | SQLite `.data/orbito.db` | Postgres for the Docker stack |
| `POSTGRES_HOST_PORT` | `5433` in Compose | Host port for the optional Docker Postgres container; avoids local Postgres on 5432 |
| `REDIS_URL` | unset | optional in v0.1 |
| `OPENAI_API_KEY` etc. | empty | gateway skips unconfigured providers |
| `OLLAMA_ENABLED` | see `.env.example` / app config | enable local Ollama; verify the task trace |
| `SCRAPING_ALLOWED_DOMAINS` | empty | comma-separated allowlist |

Provider keys never reach the browser. Changes require an API restart.

### Project Task Manager database

The `/tasks` Kanban board stores project items in `project_work_items`. Agent
execution runs stay in the existing `tasks`/`task_events` tables and may be
linked from a project item. Both use the same `DATABASE_URL`; no task is
seeded/faked.

SQLite works immediately and is easy to inspect with DB Browser for SQLite at
`apps/api/.data/orbito.db`. PostgreSQL is also supported. Docker Desktop is
currently optional; to run only the database while keeping API/web native on
Windows:

```powershell
docker compose up -d postgres
```

Compose maps PostgreSQL 17/pgvector to host port **5433** so it can coexist with
the native PostgreSQL 18 service commonly listening on 5432. Add this to `.env`
and restart the API to use Compose Postgres:

```env
DATABASE_URL=postgresql+asyncpg://orbito:orbito@127.0.0.1:5433/orbito
```

In DBeaver/DB Browser's PostgreSQL connection use host `127.0.0.1`, port `5433`,
database/user/password `orbito`. These are local development credentials only.
If you prefer the already-installed native PostgreSQL service on 5432, use its
configured database/user/password in `DATABASE_URL`; ORBITO does not guess or
change native PostgreSQL credentials. The current machine's Docker daemon is not
running, while a native PostgreSQL service is listening on 5432; the app remains
on its existing SQLite setting until a valid PostgreSQL URL is configured.

## Repository layout

```text
apps/web/src
  app/            routes (overview, chat, agents, scraping, settings, …)
  components/     brand, layout, dashboard, chat, agents, scraping, settings
  lib/            typed API client, SSE parser, types, nav/design tokens
apps/api/app
  api/v1/         HTTP surface + SSE
  core/           orchestrator, gateway, memory, permissions
  agents/         registry + specialists
  tools/          search, browser, documents, filesystem, scraping
  db/             models + repositories + session
  config/         models.yaml
docs/             architecture and contracts
```

## Tests

```bash
cd apps/api && .venv/bin/pytest -q          # unit + API + SSE
pnpm --filter @orbito/web typecheck
pnpm --filter @orbito/web lint
```

The suite runs against SQLite and the mock provider, so it is fast and needs no
network. Add a test with every feature (see `AGENTS.md`).

## Common tasks

### Route a new capability to a model

Edit `apps/api/app/config/models.yaml` or set `ORBITO_<ROLE>_MODEL`. No code.

### Add an agent

Add a subclass in `app/agents/`, register it, mirror it in
`apps/web/src/lib/agents.ts`, test routing. See [AGENTS.md](AGENTS.md).

### Add a tool

Implement `Tool` in `app/tools/`, set `permission`, register it. Validate all
paths/URLs inside the tool.

For any PC-control tool, first read `docs/IMPLEMENTATION_PLAN.md`,
`docs/SECURITY.md` and `.opencode/skills/orbito-pc-control/SKILL.md`. Current
permission declarations are not a substitute for the not-yet-complete approval
queue. Never add model-generated shell or an unbounded host action.

### Add an API route

Add a module under `app/api/v1/`, include it in `router.py`, type requests in
`api/schemas.py`. Keep provider calls out of routes.

### Reset the dev database

```bash
rm -f apps/api/.data/orbito.db*
```

## Troubleshooting

**Port already in use**

```bash
ss -ltnp | grep -E ':(3000|8000)'
```

**`database is locked`** — another process holds SQLite. Stop duplicate API
instances; WAL + 5s busy timeout are enabled, but SQLite is single-writer.

**Frontend shows "API offline"** — API is not running or `NEXT_PUBLIC_API_URL`
is wrong. Check `curl localhost:8000/api/v1/health`; CORS defaults to
`http://localhost:3000`.

**Web search step fails** — DuckDuckGo HTML may rate-limit. Add
`TAVILY_API_KEY` or `SERPER_API_KEY` for reliable search. The failure is shown
honestly in the timeline.

**No live local model** — check Ollama is running, `ollama list` shows the
configured role's model, `OLLAMA_ENABLED` and role overrides in `.env`, then
restart the API. Confirm the actual task trace shows `provider=ollama`; a healthy
API or Model Hub alone does not prove chat used Ollama. If a cloud provider or
mock was selected, the task trace must say so.

**Docker permission denied** — add your user to the `docker` group or run the
infrastructure with appropriate privileges. The app does not require Docker.

## Conventions

- Python: async, full type hints, `ruff`, 100-col lines.
- TypeScript: strict, no `any` in exported contracts, typed API client.
- IDs: UUID strings. Time: UTC ISO-8601.
- SSE: one JSON object per `data:` line; event name mirrors `type`.
- Errors: `{ "error": { "code", "message" } }`.
- Commits: `feat(scope): …`, `fix(scope): …`, `docs: …`.

## Before pushing

```bash
make test
make build
```

`make dev` and `make build` must both work. Update docs when architecture moves.
