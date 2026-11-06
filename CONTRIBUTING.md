# Contributing to ORBITO

## Workflow

```bash
git checkout -b feat/your-feature
make install          # once
make dev              # API :8000 + web :3000
make test             # before every push
```

Run from the repository root so tooling sees the whole monorepo.

## Pull requests

- One concern per PR; keep it reviewable.
- Describe the user-visible change and the architecture impact.
- Include tests and doc updates.
- Do not commit `.env`, keys, local databases, or generated media.
- Confirm `make dev` and `make build` both work.

## Commit style

`feat(career): add CV ↔ job scoring` · `fix(gateway): retry on 429` ·
`docs(security): approval matrix` · `chore(deps): bump next`

## Adding a model provider

1. Implement `BaseProvider` in `apps/api/app/core/model_gateway/providers/`.
2. Register it in `PROVIDER_FACTORIES`.
3. Add capability mapping in `app/config/models.yaml`.
4. Add a routing test in `apps/api/tests/test_model_gateway.py`.
5. Document env vars in `.env.example` and `docs/MODELS.md`.

## Adding an agent

1. Subclass `Agent` in `apps/api/app/agents/<name>/agent.py`.
2. Declare capabilities, allowed tools, and approval requirements.
3. Register it in `app/agents/registry.py`.
4. Add a UI card (`apps/web/src/lib/agents.ts`) — the UI reads the same shape.
5. Test the planner selecting it.

## Adding a tool

1. Subclass `Tool` in `apps/api/app/tools/`.
2. Declare `permission` (`auto`, `approval`, `restricted`) and timeout.
3. Register in `app/tools/registry.py`.
4. Never trust model-supplied paths/URLs — validate inside the tool.
