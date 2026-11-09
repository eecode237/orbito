---
name: ORBITO Verify and Commit
description: Use before declaring any ORBITO change done or committing it. Runs the same checks CI runs, interprets failures (including known baseline failures), handles Windows and git quirks, and writes conventional commits without committing secrets or local data.
---

## Checks (mirror `.github/workflows/ci.yml` and `Makefile`)

Web (run from the repo root):

```powershell
pnpm --filter @orbito/web typecheck
pnpm --filter @orbito/web lint
pnpm --filter @orbito/web build   # before UI-heavy or config changes
```

API:

```powershell
cd apps\api
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m py_compile <changed files>
```

`ruff` is configured in `pyproject.toml` but is not in `requirements.txt`. Run it only if installed.

Infra: `docker compose config --quiet` if compose changed. The Docker daemon may be off locally. Say so rather than skipping silently.

## Baseline (2026-11-08, Windows). Report failures, don't hide them.

- **typecheck:** passes.
- **lint:** fails with 13 errors and some warnings. Examples: `no-explicit-any` in `components/ui/chart.tsx`, `set-state-in-effect` in `components/system/system-telemetry-dashboard.tsx`.
- **pytest:** 5 failures out of 46.
  - `test_model_hub::test_overview_reports_models_hardware_and_suggestions`: memory is read from `/proc/meminfo`, which is Linux only. Windows reports 0.
  - `test_system_center::test_process_pagination_and_detail`: psutil `Process.num_fds` is POSIX only, so it raises `AttributeError`.
  - `test_system_center::test_overview_is_a_real_host_snapshot` and `test_system_monitor::test_stats_and_alerts_endpoints_return_live_shape`: not yet diagnosed.
  - `test_workspaces::test_overview_tree_and_file`: not yet diagnosed.

Rules:

- If your change adds a failure, fix it before you finish.
- If a failure predates your change, name it in your summary. Never claim "all tests pass" when they don't.
- When you touch one of the failing areas, fixing the baseline failure is in scope.

## Commit hygiene

- Use conventional commits: `feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`. Scopes in use include `api`, `web`, `markets`, `chat`, `models`, `memory`, `planet`.
- Commit periodically, one logical change per commit. This is a standing user requirement.
- Push each coherent milestone to `origin` when network/auth allow it. Check the
  configured branch and remote first; report push rejection rather than claiming
  it synced.
- Check `git status --short` first. Stage explicit paths with `git add <paths>`, never `git add -A`.
- Never stage `.env`, `.venv`, `.data`, `node_modules`, `.next`, or `__pycache__`.
- PowerShell: don't chain with `&&`. Run each git command on its own line.
- `index.lock` error: confirm no git process is running, then delete `.git/index.lock`.
- The LF→CRLF warnings on Windows are expected and harmless.
- Update docs in the same commit as any architecture or behavior change.

## Jarvis acceptance checks

For a milestone that touches the personal assistant loop, also verify the
relevant items in `docs/IMPLEMENTATION_PLAN.md`:

- **Local inference:** inspect task/model trace; API health alone does not prove
  Ollama generated the answer.
- **PC tools:** test on Windows with an injected fake adapter in CI and perform
  explicit manual acceptance on the target desktop. No real clicks, keypresses,
  app launches, file writes or audio capture in automated tests.
- **Approvals:** prove no approval means the executor is never called; modified,
  expired and replayed approvals fail closed.
- **Voice:** visible microphone state, editable transcript, explicit cancel,
  same policy as text, no recording persistence by default.
- **RAG:** answers include real file citations; deleting/reindexing removes stale
  chunks; never fabricate retrieval results.

## Local servers

- API: port 8000. Restart after backend edits.
- Web: port 3000, started with `pnpm --filter @orbito/web dev`. Next's dev server can take a few seconds to compile. Re-check the port before assuming it's down.
- Health: `GET /api/v1/health` returns 200 with `"database":"ok"`.
