# Model Gateway

Every model call in ORBITO goes through `apps/api/app/core/model_gateway`.
Agents never import a provider SDK; the gateway resolves a capability to a
provider model, streams the response, accounts for tokens and fails over.

## Roles, not model names

`app/config/models.yaml` defines roles. The shipped default is **local-first**:
every role resolves to Ollama, then the deterministic mock. Cloud models are
opt-in additions, not requirements.

| Role | Default | Used by |
|---|---|---|
| `fast` | Ollama `qwen3.5:4b` | quick chat, default |
| `smart` | Ollama `qwen3.5:4b` | general reasoning |
| `reasoning` | Ollama `qwen3.5:4b` | research, study |
| `coding` | Ollama `qwen3.5:4b` | build, automation |
| `vision` | Ollama `qwen3.5:4b` | image understanding |
| `local` | Ollama `qwen3.5:4b` | private/offline inference |
| `mock` | in-process `orbito-fast` | guaranteed offline fallback |

Each role declares provider, model, context window, list price and a fallback
chain:

```yaml
roles:
  fast:
    provider: ollama
    model: qwen3.5:4b
    label: Qwen3.5 4B (local)
    context_window: 8192
    local: true

fallbacks:
  fast: [local, mock]
```

## Local models (Ollama)

Install [Ollama](https://ollama.com), start it, and pull one model:

```bash
ollama serve
ollama pull qwen3.5:4b
```

`qwen3.5:4b` is the configured fast default for this Windows desktop. Benchmark
latency and resource use on the actual machine before changing roles. Use
**Model Hub** to see hardware, download/delete models, and check what is loaded.
Do not infer that a model/provider supports structured tool calling merely from
its name or marketing: verify the exact Ollama version/model with a real test.

```env
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CONTEXT_LENGTH=8192
OLLAMA_THINK=false
```

- `OLLAMA_CONTEXT_LENGTH` is a per-request `num_ctx` budget. Larger contexts
  need more memory and slow prefill; 8k is a good CPU default.
- `OLLAMA_THINK=false` disables the thinking trace. On a CPU-only machine it
  can turn a one-second answer into a multi-minute one. Enable it per task when
  quality matters more than latency.
- Ollama's own service context/keep-alive can also be raised with a systemd
  drop-in (`OLLAMA_CONTEXT_LENGTH`, `OLLAMA_KEEP_ALIVE`); ORBITO does not edit
  the service for you.

## Overrides

Change the deployed model without a code change:

```env
ORBITO_DEFAULT_MODEL=fast
ORBITO_FAST_MODEL=qwen3.5:4b
ORBITO_SMART_MODEL=qwen3.5:9b
ORBITO_REASONING_MODEL=qwen3.5:9b
ORBITO_CODING_MODEL=qwen2.5-coder:7b
ORBITO_VISION_MODEL=qwen3.5:4b
OLLAMA_ENABLED=true
```

Cloud keys are optional and server-side only:

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
MISTRAL_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
```

A provider is “configured” when its key exists (or Ollama is reachable and
enabled). `OLLAMA_ENABLED` defaults to `true`; set it to `false` only when you
want to force a pure cloud/mock setup.

## Resolution algorithm

1. Build the chain `[role, …fallbacks]`, deduplicated.
2. Drop providers that aren’t configured.
3. Try each in order.
4. If a provider fails **before** emitting a token → next provider.
5. If it fails **mid-stream** → surface an error to the client (no mixed answers).
6. If every provider is unavailable → `mock`.
7. Emit one authoritative `done` with usage + estimated cost.

Events: `start` → `delta*` → `done`, or `error`.

## Providers

| Provider | Protocol | Streaming | Notes |
|---|---|---|---|
| `openai` | Chat Completions | SSE | `stream_options.include_usage` |
| `anthropic` | Messages | SSE | system prompt separate, usage events |
| `google` | `streamGenerateContent?alt=sse` | SSE | multimodal capable |
| `mistral` | OpenAI-compatible | SSE | shares the OpenAI adapter |
| `ollama` | `/api/chat` | NDJSON | default local provider |
| `mock` | in-process | simulated | agent-aware deterministic answer |

## Structured tool calls (planned)

The current model gateway streams text and does not expose a general
schema-based tool-call loop to the orchestrator. Agent routing is keyword-based
and an agent may call its existing `gather()` method once. This is not the same
as a model choosing a tool. The Jarvis roadmap will add typed tool definitions
and tool-call events behind this gateway, validate proposals in the
orchestrator/tool registry, enforce approvals at execution and cap calls/rounds.
Provider-specific serialization stays in the provider adapter. If a local model
does not support the required format, the app must fail safely or use safe
deterministic routing; it must never parse model text into shell.

## Model Hub

`/api/v1/model-hub/*` exposes Ollama discovery and lifecycle so the UI never
shells out:

| Method | Path | Purpose |
|---|---|---|
| GET | `/model-hub/overview` | Server status, installed/running models, hardware, suggestions |
| GET | `/model-hub/hardware` | CPU, memory, GPUs, disk |
| GET | `/model-hub/models/show?name=` | Capabilities and context length |
| POST | `/model-hub/pull` | SSE download progress |
| DELETE | `/model-hub/models?name=` | Delete an installed model |

Model names are validated against a registry-safe pattern before they reach
Ollama. Downloads stream progress (`pulling`, `percent`, `success`) instead of
blocking a normal request for several minutes.

## Offline mock provider

If no provider is configured — or Ollama is stopped and no cloud key exists —
ORBITO boots on `mock`. It uses the request metadata (`agent`, `tool_context`)
to produce a realistic, clearly labelled answer, and streams it so the full
UI/SSE pipeline can be exercised. The UI marks the gateway as “offline ready”;
the mock never claims that an external action occurred.

## Cost accounting

`pricing.py` holds public list prices per 1M tokens. The gateway computes
`cost_usd` on the authoritative `done` event, and the orchestrator records it in
`model_usage` with the task, provider, model and capability. Estimates, not
invoices.

## Adding a provider

1. Implement `BaseProvider` in `providers/<name>.py`.
2. Register it in `PROVIDER_FACTORIES`.
3. Add its role(s) to `models.yaml` + fallback chains.
4. Add env keys to `settings` and `.env.example`.
5. Test: configured → used; error → fallback; unconfigured → skipped.

## Guardrails

- Credentials are read from settings only; never logged, prompted or sent to the
  client.
- Timeouts and max tokens are gateway settings.
- Model names come from config/env, never from model output.
- The gateway does not accept arbitrary URLs or headers from callers.
- Usage is recorded per task so budgets and billing can be enforced later.
