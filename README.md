<div align="center">

# ORBITO

**Your personal AI operating system.**

*One Agent. Infinite Possibilities.*

</div>

---

ORBITO is a modular, multi-model, multimodal AI agent platform. It takes a goal,
works out which agent should own it, picks the right model, runs the tools, and
shows you every step while it works.

```
What should we get done?
> "Find 50 AI engineering jobs in Canada and score them against my CV."
```

ORBITO is **not** a model. It is an orchestrator: a model gateway, an agent
runtime, a tool registry, and a workspace — so any provider can be swapped
without rebuilding the product.

## Status — Foundation v0.1

| Area | State |
|---|---|
| Monorepo, docs, env, Docker Compose | ✅ |
| Next.js dashboard (ORBITO design system) | ✅ |
| FastAPI backend + SQLAlchemy persistence | ✅ |
| Model Gateway (Ollama local-first, cloud optional, mock fallback) | ✅ |
| Local Model Hub (download, inspect, delete, hardware) | ✅ |
| Live system monitor + threshold alerts | ✅ |
| Orchestrator + streaming task timeline | ✅ |
| Agent registry (Career, Research, Study, Coding, Automation) | ✅ |
| Tool registry (search, browser, filesystem, documents) | ✅ |
| Chat with live execution trace | ✅ |
| Scraping Studio UI + API | ✅ (Phase 4 in progress) |
| Voice / Video, automations, billing | ⏳ Phase 6–7 |
| Auth (Better Auth) | ⏳ Phase 1 next |

With **Ollama running** (the default) ORBITO uses local models only. If the
local server is stopped and no cloud key exists, it falls back to a
deterministic mock so the entire request → plan → tools → stream → persist loop
is still usable offline.

## Quick start

```bash
# 1. Dependencies (Node 20+, Python 3.12+)
make install

# 2. Configure (optional — no keys needed to run)
cp .env.example .env

# 3. Run everything
make dev
```

- Dashboard → http://localhost:3000
- API docs → http://localhost:8000/docs
- Health → http://localhost:8000/api/v1/health

SQLite is used by default (`apps/api/.data/orbito.db`) so there is nothing else
to install. For the production-shaped stack:

```bash
make db-up                      # PostgreSQL + pgvector, Redis, MinIO
export DATABASE_URL=postgresql+asyncpg://orbito:orbito@localhost:5432/orbito
make dev
```

### Run on local models

Install [Ollama](https://ollama.com), start it, and pull the default model:

```bash
ollama serve
ollama pull qwen3.5:4b
```

ORBITO resolves every role (`fast`, `smart`, `reasoning`, `coding`, `vision`,
`local`) to Ollama out of the box, with the deterministic mock as the final
fallback. No cloud keys are needed. Open **Settings → Model Hub** to see your
hardware, download or delete models, and check what is loaded; **System** in the
sidebar shows live CPU, memory, disk, heat and battery with threshold alerts.

Model names are config, never hardcoded. To add a cloud model later:

```env
OPENAI_API_KEY=sk-...
ORBITO_FAST_MODEL=gpt-4.1-mini
```

See [docs/MODELS.md](docs/MODELS.md).

## Monorepo layout

```text
apps/web                 Next.js 16 dashboard (App Router, Tailwind v4)
apps/api                 FastAPI service
  app/core/model_gateway Model registry, routing, fallback, usage
  app/core/orchestrator  Intent → plan → agent → tools → answer
  app/agents             Career / Research / Study / Coding / Automation
  app/tools              Search, browser, filesystem, documents
  app/db                 SQLAlchemy models + repositories
  app/api/v1             Versioned HTTP + SSE API
packages/                Shared types, UI, SDK (growing)
infrastructure/docker    Container builds
docs/                    Architecture, API, models, security, roadmap
scripts/                 Dev + seed tooling
```

## Commands

```bash
make dev        # API + web together
make api        # backend only
make web        # frontend only
make test       # pytest + typecheck + lint
make build      # production web build
make db-up      # Postgres/Redis/MinIO containers
```

## Principles

1. **One application, many modules** — agents are features, not products.
2. **Models are interchangeable** — every call goes through the gateway.
3. **The user stays in control** — sensitive actions require approval.
4. **Show the work** — every task exposes its plan, steps, and cost.
5. **Boring infrastructure** — Postgres is the source of truth, Redis carries work.
6. **A runnable repo after every phase.**

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Model gateway](docs/MODELS.md)
- [Agent system](docs/AGENTS.md)
- [Database](docs/DATABASE.md)
- [Security & permissions](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)
- [Development guide](docs/DEVELOPMENT.md)

### Planning & status

- [Project breakdown](docs/PROJECT_BREAKDOWN.md) — repo audit vs. the 15-system blueprint
- [Features](docs/FEATURES.md) — living feature-status catalog
- [Project structure](docs/PROJECT_STRUCTURE.md) — current & target layout
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md) — ordered backlog
- [Hardware & local LLMs](docs/HARDWARE_OLLAMA.md) — this machine's specs and Ollama model plan

## License

Licensed under the [Apache License, Version 2.0](LICENSE). You may use, modify
and distribute this software under its terms.
