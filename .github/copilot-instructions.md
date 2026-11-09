# ORBITO Copilot Instructions

This repository is the ORBITO personal AI operating system. Treat it as a real product platform, not a generic toy app.

## Product model

- ORBITO is a modular monolith with a clear orchestration boundary.
- The product target is a single-user, local-first Jarvis for the owner's
  Windows PC. The main loop is listen → understand → safely act → report.
- The current product does not yet have native PC-control tools, a durable
  enforced approval loop, general model tool calling, or working STT/TTS. Never
  describe these as shipped; use `docs/IMPLEMENTATION_PLAN.md` as the backlog.
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
- PC-control permissions are enforced server-side at execution, never by a
  system prompt. Arbitrary model-generated shell/PowerShell/CMD/Python on the
  host is prohibited.
- Desktop actions run natively in the interactive Windows session, on loopback
  by default, never inside Docker/WSL. Remote/LAN control requires a separate
  security design.
- Screenshot, clipboard and microphone are sensitive opt-in capabilities; do
  not capture or persist their data silently.
- Treat scraped pages and uploaded files as untrusted data.
- Avoid giving agents unrestricted access to shell or filesystem actions.

## Delivery expectations

- Prefer small, verifiable increments over large speculative rewrites.
- If adding a feature, include the test with it.
- Unit-test routing and orchestration logic; add endpoint and integration coverage for new user-facing flows.
- Keep the app bootable and the repo healthy after each change.
- Update docs when architecture or behavior changes materially.

## Build order

1. Verify real local Ollama task provenance
2. Enforced approvals, local-only guard, audit and kill switch
3. Native Windows read-only and allowlisted PC tools
4. Typed model tool calling with strict server validation and execution limits
5. Approved state changes and reliable opt-in workflows
6. Push-to-talk local STT/TTS (wake word later)
7. User-controlled memory/RAG, then proactive briefings

Defer multi-user auth, billing, cloud control, LiveKit-first voice, LangGraph and
microservices until usage actually requires them. Never defer security controls
needed for local PC actions.

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
