---
name: ORBITO Model Gateway
description: Use when changing how ORBITO calls language models, adds or edits model roles or providers, touches Ollama or the Model Hub, fallbacks, usage and cost accounting, or any code that generates text.
---

## Rules

- All model calls go through `apps/api/app/core/model_gateway/`. Agents, routes, and tools never import a provider SDK or call a provider HTTP API directly.
- Code uses roles (`fast`, `smart`, `reasoning`, `coding`, `vision`, `local`, `mock`), not model names. Names come only from `app/config/models.yaml` and environment overrides.
- One provider is one file in `model_gateway/providers/`, registered once.
- Fallbacks are declared under `fallbacks:` in `models.yaml`. The chain ends in the deterministic `mock` provider, so the app always answers offline and says so. The `task.created` event carries `offline: true` in that case.

## Layout

- `router.py`: resolves a capability to a provider model, with fallback.
- `registry.py`: role specs and the registry.
- `schemas.py`: `Message`, `GenerationRequest`, usage types.
- `pricing.py`: list prices for cost.
- `hub.py`: Ollama management only (`/api/version`, `/api/tags`, `/api/ps`, `/api/show`, `/api/pull`, `/api/delete`). It never generates.
- `providers/ollama.py`: generation. Read it before writing a new provider, and copy its interface.

## Local setup (Ollama)

Environment names are in `.env.example`: `OLLAMA_BASE_URL`, `OLLAMA_ENABLED`, `OLLAMA_CONTEXT_LENGTH`, `OLLAMA_THINK`, and the `ORBITO_*_MODEL` role variables. Check `models.yaml` before assuming a mapping. Keep default roles small: this machine runs Ollama on CPU, and large models are slow.

## Adding a provider

1. Create `providers/<name>.py` with the same interface as `ollama.py`.
2. Register it once in the gateway registry.
3. Read keys and base URLs from settings. Add the variable name to `.env.example`, names only.
4. Add role entries and a fallback chain in `models.yaml`.
5. Record usage through the existing accounting (`repo.record_usage`).
6. Add routing tests in `tests/test_model_gateway.py`, faking the transport. Never call a real provider in tests.
7. Update `docs/MODELS.md` in the same commit.

## Model Hub

- Endpoints: `apps/api/app/api/v1/model_hub.py` (`/overview`, `/search`, `/pull` as SSE, `/models` delete, `/models/show`).
- Downloads stream Ollama's progress as SSE. Never fake progress.
- Library search hits the public ollama.com site and must degrade to an honest "unavailable" state.
- Hardware probing: `hub.py` `_hardware_sync` reads `/proc/meminfo` and `/proc/cpuinfo`, which are Linux only. Windows reports 0 memory. Use psutil (already in requirements) for cross-platform memory and disk before trusting these numbers on Windows.

## Gotchas

- Serialize model objects safely. Some results are dicts, others are pydantic models. Commit `1b7426a` added the hardening. Keep it.
- The gateway owns retries and fallback. Don't add ad hoc retry loops in agents.

## Jarvis tool calling (planned, not shipped)

- Current execution is deterministic keyword routing + one agent `gather()`;
  don't claim that Qwen chooses tools from the registry yet.
- Extend the shared gateway request/event contract for typed tool definitions and
  tool-call results. Provider-specific JSON/message formats stay in
  `providers/<provider>.py`; never place format conversion in agents or routes.
- Verify support against the exact Ollama version and configured local model.
  Keep a deterministic safe fallback when tool calls are unsupported or
  malformed. Never interpret model text as a shell command.
- The orchestrator validates and bounds each proposal, checks policy/approval,
  calls only the tool registry, returns the real tool result, and caps rounds,
  calls, wall time, tokens and result bytes. Prompts do not grant permission.
- Add fake-provider unit tests plus a manual real Ollama acceptance test. Do not
  hit real models from CI.

## Product priority

Read `docs/IMPLEMENTATION_PLAN.md`: verify local inference → enforced approval
spine → native Windows tools → typed tool calling → push-to-talk local STT/TTS →
local embeddings/RAG → proactive workflows. Multi-user SaaS, billing and
remote-control are deferred until actually required.
