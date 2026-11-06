# AGENTS.md — rules for coding agents working in this repository

Read this before changing code. These rules exist so ORBITO can grow without
turning into a pile of provider-specific hacks.

## Read first

1. `docs/ARCHITECTURE.md` — boundaries and data flow.
2. `docs/MODELS.md` — how model access works.
3. `docs/AGENTS.md` — agent contracts.
4. `docs/SECURITY.md` — what requires approval.

## Hard rules

1. **All model calls go through `app/core/model_gateway`.** Never import a
   provider SDK directly from an agent, route, tool, or worker.
2. **Never hardcode credentials, base URLs, or model names.** Read providers
   from settings and models from `app/config/models.yaml` / environment.
3. **Respect module boundaries.** Import direction is:
   `api → core → agents → tools`, plus `core → model_gateway`.
   Agents may depend on tools and the gateway, never on `api`.
   No circular imports.
4. **Contracts are typed.** Pydantic schemas for backend I/O; TypeScript types
   for frontend payloads (`apps/web/src/lib/types.ts`).
5. **Sensitive actions never auto-run.** Shell, email, application submission,
   file deletion, and account access require an approval gate.
6. **Sandbox generated code.** No arbitrary model-generated shell on the host.
7. **One integration per provider.** Add a new model provider in exactly one
   file under `model_gateway/providers/` and register it once.
8. **Write the test with the feature.** Minimum: unit test for gateway routing
   and orchestrator planning; integration test for the endpoint.
9. **Do not introduce a second framework** for something already covered
   (routing, queueing, ORM, auth) without a documented decision.
10. **Update docs when architecture changes** — same commit, not later.
11. **Keep `make dev` working.** The repo must boot after every phase.
12. **No secrets in Git, logs, prompts, or frontend bundles.**

## Conventions

- Python: async by default, `ruff` formatting, 88 cols, full type hints.
- TypeScript: strict mode, no `any` in exported contracts.
- CSS: Tailwind utilities + design tokens in `apps/web/src/app/globals.css`.
- IDs: UUIDv4 strings. Timestamps: UTC ISO-8601.
- API routes live under `/api/v1/<domain>`; SSE for task progress.
- Errors: `{ "error": { "code": "...", "message": "..." } }`.
- Commits: `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `chore: ...`.

## Definition of done for a feature

- [ ] Works end-to-end in the UI and API.
- [ ] Typed contracts on both sides.
- [ ] Audit/usage event emitted where relevant.
- [ ] Test added and `make test` passes.
- [ ] Docs updated.
