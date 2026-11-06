# Model Gateway

Every model call in ORBITO goes through `apps/api/app/core/model_gateway`.
Agents never import a provider SDK; the gateway resolves a capability to a
provider model, streams the response, accounts for tokens and fails over.

## Roles, not model names

`app/config/models.yaml` defines roles:

| Role | Default | Used by |
|---|---|---|
| `fast` | Gemini 2.5 Flash | quick chat, default |
| `smart` | GPT-4.1 mini | general reasoning |
| `reasoning` | Claude Sonnet 4.5 | research, study |
| `coding` | Claude Sonnet 4.5 | build, automation |
| `vision` | Gemini 2.5 Flash | image/video understanding |
| `local` | Ollama `llama3.2` | private/offline inference |

Each role declares provider, model, context window, list price and a fallback
chain:

```yaml
roles:
  fast:
    provider: google
    model: gemini-2.5-flash
    label: Gemini 2.5 Flash

fallbacks:
  fast: [smart, local, mock]
```

## Overrides

Change the deployed model without a code change:

```env
ORBITO_DEFAULT_MODEL=fast
ORBITO_FAST_MODEL=gpt-4.1-mini
ORBITO_SMART_MODEL=claude-haiku-4-5
ORBITO_REASONING_MODEL=claude-sonnet-4-5
ORBITO_CODING_MODEL=claude-sonnet-4-5
ORBITO_VISION_MODEL=gemini-2.5-pro
OLLAMA_ENABLED=true
```

Keys (server-side only):

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
MISTRAL_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
```

A provider is “configured” when its key exists. Ollama is opt-in
(`OLLAMA_ENABLED=true`) so a missing local server never adds latency.

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
| `ollama` | `/api/chat` | NDJSON | opt-in local models |
| `mock` | in-process | simulated | agent-aware deterministic answer |

## Offline mock provider

With no keys, ORBITO boots on `mock`. It uses the request metadata (`agent`,
`tool_context`) to produce a realistic, clearly labelled answer, and streams it
so the full UI/SSE pipeline can be exercised. The UI marks the gateway as
“offline ready”; the mock never claims that an external action occurred.

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
