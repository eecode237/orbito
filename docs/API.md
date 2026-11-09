# ORBITO API (v1)

Base URL: `http://localhost:8000/api/v1` · OpenAPI: `http://localhost:8000/docs`

All JSON. Errors use:

```json
{ "error": { "code": "http_400", "message": "Unsafe URL …" } }
```

Auth is not enforced in Foundation v0.1: requests map to the local demo user.
Do not expose this build publicly before Phase 1.

## System

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | App/database/provider readiness |
| GET | `/system/tools` | Registered tools and permission levels |
| GET | `/system/stats` | Live CPU, memory, swap, disk, temperature, battery, Ollama |
| GET | `/system/alerts` | Threshold alerts derived from the latest snapshot |
| GET | `/usage` | Aggregate requests, tokens, estimated cost |

```bash
curl localhost:8000/api/v1/health
curl localhost:8000/api/v1/system/stats
```

`/system/stats` is sampled from `/proc` and `/sys` (no `psutil` dependency) and
cached for one second so several dashboard tabs do not each wake the machine.
Alert thresholds are environment settings (`ALERT_MEMORY_PERCENT`,
`ALERT_DISK_PERCENT`, `ALERT_TEMPERATURE_C`, and so on). Levels are `warning`
or `critical`; a healthy machine returns an empty list.

## Model Hub

| Method | Path | Purpose |
|---|---|---|
| GET | `/model-hub/overview` | Ollama status, installed/running models, hardware, suggestions |
| GET | `/model-hub/hardware` | CPU, memory, GPUs, disk |
| GET | `/model-hub/models/show?name=` | Model capabilities and context length |
| POST | `/model-hub/pull` | Download a model; returns SSE progress |
| DELETE | `/model-hub/models?name=` | Delete an installed model |

```bash
curl localhost:8000/api/v1/model-hub/overview
curl -N -X POST localhost:8000/api/v1/model-hub/pull \
  -H 'Content-Type: application/json' -d '{"name":"qwen3.5:4b"}'
```

Unlike chat, Model Hub endpoints work even when `OLLAMA_ENABLED=false`: they
report the server as offline instead of hiding it.

## Chat

### `POST /chat`

```json
{
  "message": "Find 20 AI jobs in Canada and score them against my CV",
  "conversation_id": null,
  "agent": "auto",
  "model_role": null,
  "workspace_id": null,
  "stream": true
}
```

- `agent`: `auto` | `core` | `career` | `research` | `study` | `coding` | `automation`
- `model_role`: `fast` | `smart` | `reasoning` | `coding` | `vision` | `local`
- `stream`: `true` → SSE, `false` → single `ChatResponse`

`ChatResponse`:

```json
{
  "task_id": "uuid",
  "conversation_id": "uuid",
  "message": "markdown answer",
  "agent": { "slug": "career", "name": "Career", "...": "..." },
  "model": { "provider": "mock", "name": "orbito-fast", "role": "fast" },
  "usage": { "prompt_tokens": 120, "completion_tokens": 300, "total_tokens": 420 },
  "cost_usd": 0.0
}
```

### SSE events

Each event is `event: <type>` plus `data: <json>`.

| Event | Payload |
|---|---|
| `conversation` | `conversation_id` |
| `task.created` | `task_id`, `agent`, `model`, `model_role`, `steps[]` |
| `step.updated` | `index`, `title`, `status`, `detail` |
| `sources` | `sources: [{title, url}]` |
| `delta` | `text` |
| `done` | `task_id`, `message`, `agent`, `model`, `usage`, `cost_usd` |
| `error` | `error`, optional `task_id` |

```bash
curl -N -X POST localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Create a 5-day study plan","agent":"study"}'
```

## Catalog

| Method | Path | Purpose |
|---|---|---|
| GET | `/agents` | Agent registry + tool registry |
| GET | `/models` | Roles, provider status, fallback chains |

## Tasks

`/tasks` are **ORBITO execution runs** (one agent/model run, steps, events and
result). They are not the user-managed Jira-style backlog.

| Method | Path | Purpose |
|---|---|---|
| GET | `/tasks?limit=25` | Recent tasks with steps |
| GET | `/tasks/{id}` | One task, plan and result |
| POST | `/tasks/{id}/cancel` | Mark cancelled |
| POST | `/tasks/{id}/approve?approved=true` | Record approval on a task |

## Project Task Manager

`/project-tasks` stores planning work items in the configured database. The UI
shows a Kanban board, unscheduled backlog, day plan and tomorrow plan. Project
items are separate from execution runs; starting one in Chat records the latest
execution ID on the project item, but does **not** automatically mark the project
item done.

| Method | Path | Purpose |
|---|---|---|
| GET | `/project-tasks/board?target_date=YYYY-MM-DD&q=` | Board items + counts + scheduled-today/tomorrow summary |
| POST | `/project-tasks` | Create `{title, description?, status?, priority?, scheduled_for?, due_date?, estimate_minutes?, labels?}` |
| GET | `/project-tasks/{id}` | One project item |
| PATCH | `/project-tasks/{id}` | Edit fields or move status |
| DELETE | `/project-tasks/{id}` | Delete the planning item; linked execution logs remain |

Statuses: `backlog`, `todo`, `in_progress`, `blocked`, `done`. Priorities:
`low`, `normal`, `high`, `urgent`. Dates are `YYYY-MM-DD` in the user's local
calendar. `/chat` accepts optional `project_task_id`; this is how “Run with
ORBITO” links a real execution run to a board item.

`DATABASE_URL` controls persistence. SQLite is the no-setup default. For Docker
PostgreSQL, run `docker compose up -d postgres`, set the API's
`DATABASE_URL=postgresql+asyncpg://orbito:orbito@127.0.0.1:5433/orbito`, then
restart the native Windows API. Connect DB Browser/DBeaver to host `127.0.0.1`,
port `5433`, database/user/password `orbito`. The compose database is local
development only; change its credentials before any shared deployment.

## Conversations

| Method | Path | Purpose |
|---|---|---|
| GET | `/conversations?limit=30` | Recent conversations |
| GET | `/conversations/{id}/messages` | Full message history |

## Memory

| Method | Path | Purpose |
|---|---|---|
| GET | `/memory` | List long-term memories |
| POST | `/memory` | `{content, scope, key?, workspace_id?}` |
| DELETE | `/memory/{id}` | Delete a memory |

## Scraping

### `POST /scraping/jobs`

```json
{
  "name": "Competitor pricing",
  "urls": ["https://example.com/pricing"],
  "schema": {
    "plan": { "selector": ".plan-name" },
    "price": { "selector": ".price", "attribute": "text" },
    "cta": { "selector": "a.cta", "attribute": "href" }
  },
  "config": { "depth": 1, "max_pages": 10, "follow_links": true }
}
```

Schema forms:

- `"field": "css selector"` → text of first match
- `"field": { "selector": "…", "attribute": "href|src|text|html|…" }`
- `"field": { "selector": "…", "multiple": true }` → list

| Method | Path | Purpose |
|---|---|---|
| POST | `/scraping/jobs` | Create + schedule a job |
| GET | `/scraping/jobs` | Recent jobs |
| GET | `/scraping/jobs/{id}` | Job progress + results |
| GET | `/scraping/jobs/{id}/export?format=json\|csv` | Download |

Safety: only `http(s)`, DNS-resolved public IPs, optional domain allowlist,
`SCRAPING_MAX_PAGES` ceiling. Login/CAPTCHA/paywall bypass is out of scope.

## Files

| Method | Path | Purpose |
|---|---|---|
| POST | `/files/upload` | Multipart upload (25 MB cap) |
| GET | `/files` | File metadata |

## Status codes

`200/201` success · `204` deleted · `400` validation/unsafe input ·
`404` missing · `413` upload too large · `422` schema error ·
`502` generation failure · `503` persistence/queue unavailable.
