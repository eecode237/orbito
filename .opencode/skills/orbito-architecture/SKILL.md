---
name: ORBITO Architecture
description: Use when planning or placing any ORBITO change (feature, module, route, agent, tool, or doc), deciding which layer owns code, or checking import boundaries in the monorepo.
---

## Read first

1. `AGENTS.md` at the repo root (hard rules).
2. `docs/ARCHITECTURE.md`, `docs/MODELS.md`, `docs/AGENTS.md`, `docs/SECURITY.md`.
3. `.github/copilot-instructions.md` mirrors these rules. If you change a rule, update both.

## Where code lives

| Concern | Location |
| --- | --- |
| HTTP routes (thin) | `apps/api/app/api/v1/<domain>.py`, registered via `app/main.py` |
| Pydantic contracts | `apps/api/app/api/schemas.py` |
| SSE helper | `apps/api/app/api/sse.py` |
| Orchestration loop | `apps/api/app/core/orchestrator/runner.py` |
| Memory recall and capture | `apps/api/app/core/memory/store.py` |
| Model access (only place) | `apps/api/app/core/model_gateway/` (`router.py`, `registry.py`, `hub.py`, `providers/`) |
| Agents | `apps/api/app/agents/` |
| Tools (fs, web, scraping, net guard) | `apps/api/app/tools/` (`net.py` is the SSRF guard) |
| Persistence | `apps/api/app/db/models.py`, `repositories.py`, `session.py` |
| Model roles | `apps/api/app/config/models.yaml` (+ env overrides) |
| Web routes | `apps/web/src/app/<route>/page.tsx` (thin) |
| Web components | `apps/web/src/components/<domain>/` |
| Web contracts and API client | `apps/web/src/lib/types.ts`, `apps/web/src/lib/api.ts` |
| Navigation | `apps/web/src/lib/nav.ts` |

## Import direction

`api → core → agents → tools`, plus `core → model_gateway` and `core → db`.

- Agents never import `api`.
- Routes never import provider SDKs or build raw model calls.
- No circular imports. If you need one, move the shared piece down a layer.

## Placement decision

- New HTTP surface: router + schema + repo function + test.
- Planning, tool sequencing, task lifecycle: `core/orchestrator`.
- Any text generation: `model_gateway` only.
- Any user-supplied URL fetch: go through `tools/net.py`.
- UI-only state: components. Keep business rules out of pages.

## Standing rules

- Real data only. Show unknown, offline, and stale states honestly. Never seed fake history, metrics, or activity.
- Errors: AGENTS.md specifies `{ "error": { "code", "message" } }`. Existing routes mostly raise `HTTPException(detail=...)`, and `parseError` in `api.ts` accepts both. New code should use the envelope.
- Do not add a second framework for routing, queueing, ORM, or auth without a documented decision in `docs/`.
- If architecture changes, update the docs in the same commit.
- Keep `make dev` bootable after every change.
