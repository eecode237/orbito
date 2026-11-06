# Development

## Prerequisites

- Node.js 20+ and pnpm 9+ (`corepack enable`)
- Python 3.12+
- Docker (optional, for PostgreSQL/Redis/MinIO)

## First run

```bash
git clone <repo> orbito && cd orbito
cp .env.example .env
make install      # pnpm install + Python venv + pip requirements
make dev          # API :8000 + web :3000
```

Open http://localhost:3000. No API keys are required — ORBITO uses the offline
mock provider until you add one.

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
| `REDIS_URL` | unset | optional in v0.1 |
| `OPENAI_API_KEY` etc. | empty | gateway skips unconfigured providers |
| `OLLAMA_ENABLED` | `false` | opt in to local models |
| `SCRAPING_ALLOWED_DOMAINS` | empty | comma-separated allowlist |

Provider keys never reach the browser. Changes require an API restart.

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

**No live model** — expected without keys. Add one, restart the API, confirm
Settings → Providers shows `connected`.

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
