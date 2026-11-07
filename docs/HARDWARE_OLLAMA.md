# Hardware Profile & Local LLM Plan (Ollama)

**Measured on this machine — 2026-11-07.** These are the real specs ORBITO must
adapt to. The original blueprint assumed a ThinkPad T16 (i7-1355U, Iris Xe,
Ubuntu); **this machine is different**, and every monitoring/model decision in
the repo should follow this document instead.

## 1. Measured specifications

| Component | Value | Notes for ORBITO |
|---|---|---|
| Machine | MSI B550-A PRO desktop (MS-7C56) | **No battery** — battery widgets must show "Not available", never fake values |
| OS | Windows 11 Pro (build 26300), 64-bit | Not Ubuntu: no systemd, no Linux thermal zones, different process semantics |
| CPU | AMD Ryzen 7 5700X — 8 cores / 16 threads, 3.4 GHz base (~4.6 GHz boost) | AVX2, no AVX-512. Good CPU-inference chip for ≤ 9B Q4 models |
| RAM | 32 GB (18.3 GB free at measurement) | Budget in §4. Alert thresholds 90/96% in `.env.example` are sane here |
| GPU | AMD Radeon RX 5700 XT, **8 GB VRAM** (RDNA1, gfx1010) | WMI reports 4 GB — that is a 32-bit counter cap; the card has 8 GB. See §3 |
| Disk C: | 1 TB NVMe (NX-1TB 2280) — **724 GB free** | Put Ollama models, Postgres/Redis (WSL2), media here |
| Disk D: | 1 TB HDD (ST1000LM035) — 241 GB free | Backups, archives, scraped-data exports |
| Disk E: | 320 GB HDD (ST320LT012) — 127 GB free | Current repo location (`E:\Labs\orbito\orbito`) — fine for code, slow for `node_modules`/`.venv`; consider moving the repo to C: |
| Ollama | **v0.40.15 installed, 0 models pulled** | Gateway currently falls back to `mock` on this machine until §5 is done |
| nvidia-smi | Not present | No NVIDIA tooling; do not probe for it |

## 2. What this means vs. the blueprint

1. **CPU-first inference.** The 5700X handles 4B–9B quantized models at usable
   speeds; 14B is slow-but-possible; ≥ 32B is not practical locally.
2. **More headroom than the ThinkPad** (desktop cooling, 8-core vs. 2+8 U-series)
   but the **GPU is not usable by Ollama in the default path** (see §3).
3. **Windows adaptations required** in System Center: battery = N/A, CPU
   temperature = best-effort (psutil often cannot read it on Windows), AMD GPU
   metrics = best-effort, process termination uses `psutil.terminate()/kill()`
   instead of SIGTERM/SIGKILL semantics.
4. **Docker stack needs Docker Desktop + WSL2.** Until then keep the SQLite
   default (`make dev` works as-is).

## 3. GPU reality check (RX 5700 XT)

- Ollama's ROCm path on Windows does **not** support gfx1010 (RDNA1) — assume
  **no GPU offload by default**.
- Newer Ollama builds include an **experimental Vulkan backend**. Worth one
  test: set `OLLAMA_VULKAN=1` as a system env var, restart Ollama, run a
  generation and compare tokens/s and whether `ollama ps` reports GPU layers.
  If it is unstable or slower, unset it — CPU is the supported baseline.
- Do **not** plan features around VRAM. The 8 GB card is still useful for the
  browser, the Three.js Planet globe and UI compositing.
- WSL2 + ROCm is not an option for this card (RDNA1 dropped from ROCm support).

## 4. Memory budget (32 GB total)

| Consumer | Budget |
|---|---|
| Windows 11 + desktop apps | ~5 GB |
| ORBITO stack (FastAPI + Next.js dev + SQLite/Postgres + Redis) | ~4 GB |
| Browser (dashboard, WebGL globe) | ~3 GB |
| **Reserved for Ollama models** | **~16 GB** |
| Safety headroom (alert at 90%) | ~3 GB |

Rules derived from this budget:

- At most **2 models loaded simultaneously** (e.g. one chat model + embeddings).
  Set `OLLAMA_MAX_LOADED_MODELS=2`.
- **One concurrent generation** (`OLLAMA_NUM_PARALLEL=1`) — CPU inference does
  not benefit from parallel requests, it just splits tokens/s.
- A 9B Q4 model (~6 GB) + 4B Q4 (~3 GB) + embedder (~0.3 GB) fits; adding a
  14B does not fit alongside the dev stack.
- The future resource-aware scheduler (blueprint §13) must treat "load a bigger
  model" as a gated action on this machine.

## 5. Model plan — pull list and role mapping

Expected CPU speeds on this chip (Q4_K_M, 8k context, single stream):
4B ≈ 15–25 tok/s · 7B ≈ 10–14 tok/s · 9B ≈ 7–11 tok/s · 14B ≈ 4–6 tok/s.

| Gateway role | Model | Size | Why |
|---|---|---|---|
| `fast` / `smart` / `vision` / `local` | `qwen3.5:4b` | ~3 GB | Repo default; tools + vision; responsive on CPU |
| `reasoning` | `qwen3.5:9b` | ~6 GB | Research/study quality bump; still fits budget |
| `coding` | `qwen2.5-coder:7b` | ~4.7 GB | Purpose-built code model |
| embeddings (Phase 2) | `nomic-embed-text` | ~0.3 GB | Cheap, fast, good retrieval quality |

Setup (PowerShell):

```powershell
# Models land on C:\Users\<you>\.ollama\models (NVMe) by default — keep it there.
ollama pull qwen3.5:4b
ollama pull qwen3.5:9b
ollama pull qwen2.5-coder:7b
ollama pull nomic-embed-text

# Recommended Ollama service env vars (System environment variables):
#   OLLAMA_HOST=127.0.0.1:11434
#   OLLAMA_KEEP_ALIVE=10m          # avoid reloading from NVMe every request
#   OLLAMA_MAX_LOADED_MODELS=2
#   OLLAMA_NUM_PARALLEL=1
#   OLLAMA_VULKAN=1                # EXPERIMENT: try once, remove if unstable
```

ORBITO `.env` overrides for this machine:

```env
ORBITO_FAST_MODEL=qwen3.5:4b
ORBITO_SMART_MODEL=qwen3.5:4b
ORBITO_REASONING_MODEL=qwen3.5:9b
ORBITO_CODING_MODEL=qwen2.5-coder:7b
ORBITO_VISION_MODEL=qwen3.5:4b
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CONTEXT_LENGTH=8192
OLLAMA_THINK=false
```

Storage: ~14 GB for the four models; budget 50 GB on C: for future pulls.
Manage everything through **Settings → Model Hub** (pull progress, delete,
loaded models) — it uses the hub API, never shells out.

## 6. Cloud split for this hardware

Run locally: chat, planning, coding assistance, embeddings, summarization,
4B/9B reasoning, document Q&A (with 8k context), scraping, telemetry.

Use cloud providers (optional keys) for: long-context work (> 32k), heavy
multi-step reasoning, video understanding, image/video generation, and anything
latency-critical that a 9B CPU model handles too slowly. The gateway already
skips unconfigured providers — nothing to change in code.

## 7. Verification checklist

- [x] `ollama list` shows the four models. (2026-11-07: qwen3.5:4b, qwen3.5:9b,
      qwen2.5-coder:7b, nomic-embed-text)
- [x] `curl http://localhost:11434/api/tags` responds (Ollama service running).
- [x] Model Hub overview reports Ollama **connected** with hardware summary
      (`/api/v1/health` shows `"ollama": true, "live_provider": true`).
- [x] A chat message streams from `qwen3.5:4b` (not `mock`) — verified for the
      core agent (14.2s) and the career specialist with tool call (40.2s).
- [ ] `ollama ps` during generation shows the loaded model and memory size.
- [ ] System page shows real CPU/RAM/disk; battery and CPU temperature show
      "Not available" (not fake numbers) on this desktop.
- [ ] (Optional) Vulkan experiment: compare tok/s with and without
      `OLLAMA_VULKAN=1`; keep whichever is stable.

## 8. Follow-ups for the codebase (tracked in IMPLEMENTATION_PLAN.md)

1. Model Hub hardware view: label the RX 5700 XT VRAM correctly (WMI 4 GB cap)
   and mark GPU inference as unavailable/experimental rather than absent.
2. System Center Windows path: battery N/A, best-effort temps
   (document LibreHardwareMonitor/WMI as optional sources), `terminate()/kill()`
   process semantics.
3. `.env.example`: add the `OLLAMA_KEEP_ALIVE / MAX_LOADED_MODELS /
   NUM_PARALLEL` guidance as comments for local-first setups.
4. Resource-aware scheduling: refuse to queue a second heavy generation while
   RAM > 85% (alert thresholds already exist).
