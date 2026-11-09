---
name: ORBITO API Feature
description: Use when adding or changing a FastAPI endpoint, Pydantic schema, repository function, or backend service under apps/api, including its pytest coverage and how to run the API locally.
---

## Workflow

1. **Route.** Put the endpoint in `apps/api/app/api/v1/<domain>.py` (create the module if the domain is new). Register it in the v1 router the same way existing domains are included. Check `app/api/v1/__init__.py` (or the existing `include_router` chain) first.
2. **Contract.** Add request and response models to `app/api/schemas.py` (Pydantic v2, with `Field` bounds and validators). Return plain dicts shaped like `conversations.py`. Never return ORM objects.
3. **Persistence.** Add the function to `app/db/repositories.py`. Routes call repo functions, never `SessionLocal` directly. Some repo reads log and return `[]` or `None` on failure. For writes that must succeed, map `None` to 503 (see `memory.py` POST).
4. **Ownership.** Scope every query by `user_id` (`repo.DEMO_USER_ID` is the current single-user default). Check ownership before delete.
5. **Sensitive actions.** Writes that touch files, submit forms, send messages, or run commands need an approval gate. See `orbito-security-review`.
6. **Streams.** Use `app/api/sse.py` (`sse()` and `SSE_HEADERS`) for progress streams.
7. **Read-only feeds.** For upstream feeds, return an honest `reachable: false` payload with `error` instead of a 500 (see `orbito-market-data`).
8. **Tests.** Add `apps/api/tests/test_<domain>.py` with `TestClient(app)`. Fake outbound HTTP with `httpx.MockTransport`, as in `tests/test_model_hub.py`. `tests/conftest.py` sets `OLLAMA_ENABLED=false`, so tests never reach a real model server. Tests must not hit live public APIs.

## Conventions

- `async def` routes, full type hints, `from __future__ import annotations`.
- Line length: `pyproject.toml` sets ruff `line-length = 100`. AGENTS.md says 88. Follow the tool config until the two are reconciled, and flag the mismatch.
- Absolute imports from `app.` only.
- IDs are UUIDv4 strings. Timestamps are UTC ISO-8601.

## Commands

Windows (PowerShell, from `apps/api`):

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pytest -q tests/test_intel.py
.\.venv\Scripts\python.exe -m py_compile app\api\v1\<domain>.py
```

POSIX: `.venv/bin/pytest -q`, or `make test` from the repo root.

Run the API on port 8000:

```powershell
cd apps\api; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Restart the API after backend edits. Windows uvicorn is not started with `--reload`. Health check: `GET /api/v1/health` should return 200 with `"database":"ok"`.
