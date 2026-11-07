---
applyTo: "**/*.py, **/*.ts, **/*.tsx, **/*.md"
---

# ORBITO core instructions

Use these rules when working in ORBITO repositories.

## Always follow

- Read AGENTS.md before making code changes.
- Keep model provider access behind the model gateway.
- Respect the API → core → agents → tools layering.
- Prefer task, agent, and execution traces over hidden state.
- Keep the design consistent with the existing ORBITO workspace.

## Product expectations

- Build for a real AI operating system, not a static mockup.
- Show real status, real tasks, and real telemetry wherever possible.
- If data is missing or unsupported, clearly surface that state.
- Avoid fake activity, fake model usage, and fake success states.

## Frontend expectations

- Maintain a premium dark operating-system aesthetic.
- Use design tokens instead of ad hoc color values.
- Keep components typed and reusable.
- Prefer responsive layouts that remain legible under real workloads.

## Backend expectations

- Keep provider integration centralized.
- Keep security boundaries explicit.
- Add tests with behavior changes.
- Prefer explicit task records, execution logs, and approvals.

## Build focus

- First: architecture integrity and system boundaries
- Second: model routing and execution
- Third: agent and task runtime
- Fourth: telemetry, dashboards, and observability
- Fifth: discovery and workflow capabilities
- Final: hardening, approval flow, and production readiness
