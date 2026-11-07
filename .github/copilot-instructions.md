# ORBITO Copilot Instructions

This repository is the ORBITO personal AI operating system. Treat it as a real product platform, not a generic toy app.

## Product model

- ORBITO is a modular monolith with a clear orchestration boundary.
- AI behavior should flow through the model gateway and orchestration layer, not directly from UI or provider code.
- Agents, tasks, models, tools, memory, and security are first-class system concerns.
- The UI is the control surface; the backend is the real operating system.

## Architecture rules

- Route all model access through app/core/model_gateway.
- Do not import provider SDKs directly from agents, routes, tools, or workers.
- Respect the module boundary: api → core → agents → tools, plus core → model_gateway and core → db.
- Keep the model gateway as the single provider integration layer.
- Preserve one integration per provider and register it once.
- Prefer task-driven execution and explicit traces over ad hoc flows.

## Security rules

- Never hardcode secrets, URLs, or model identifiers in app code.
- Read configuration from settings and environment variables.
- Keep approval gates for writes, submissions, email, shell actions, and destructive file work.
- Treat scraped pages and uploaded files as untrusted data.
- Avoid giving agents unrestricted access to shell or filesystem actions.

## Delivery expectations

- Prefer small, verifiable increments over large speculative rewrites.
- If adding a feature, include the test with it.
- Unit-test routing and orchestration logic; add endpoint and integration coverage for new user-facing flows.
- Keep the app bootable and the repo healthy after each change.
- Update docs when architecture or behavior changes materially.

## Build order

1. Foundation: API structure, config, security baseline, database conventions
2. Model gateway and routing
3. Agent orchestration and task lifecycle
4. System telemetry and observability
5. Dashboard and command center
6. Discovery systems: scraping, jobs, news
7. Knowledge, study, and media capabilities
8. Automation and production hardening

## Repo conventions

- Python: async by default, full type hints, ruff-friendly formatting.
- TypeScript: strict mode, typed contracts, no implicit any in exported contracts.
- Keep new frontend work aligned with the existing ORBITO design language.
- Use real data and status sources; do not invent active agents, tasks, metrics, or model states.
- When a status is unknown or unsupported, show the real unknown state instead of a fabricated success state.

## Working style

- Read the repo rules in AGENTS.md before changing code.
- Prefer existing patterns in the app over introducing new frameworks for things already solved.
- Keep interfaces typed and inspectable.
- Avoid circular imports and avoid broad cross-cutting changes without a clear reason.
- Document behavior if it changes the architecture or product boundaries.

## When building new work

- Check whether the feature belongs in the API layer, core orchestration layer, agent layer, or tool layer.
- Keep tasks traceable with a persistent task record and clear event lifecycle.
- Surface status, outputs, and failures with user-safe messaging.
- Make the feature observable and debuggable, not just visually impressive.

## Default behavior

- Use local-first model patterns where available.
- Favor deterministic, testable orchestration logic.
- Keep the product honest: if a provider is not connected, say so.
- Build for real control surfaces and real task execution, not fake dashboard activity.
