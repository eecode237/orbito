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
| GET | `/usage` | Aggregate requests, tokens, estimated cost |

```bash
curl localhost:8000/api/v1/health
```

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

| Method | Path | Purpose |
|---|---|---|
| GET | `/tasks?limit=25` | Recent tasks with steps |
| GET | `/tasks/{id}` | One task, plan and result |
| POST | `/tasks/{id}/cancel` | Mark cancelled |
| POST | `/tasks/{id}/approve?approved=true` | Record approval on a task |

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
