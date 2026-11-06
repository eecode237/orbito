# Agent System

Agents are declarative specialists executed by one orchestrator. They share
memory, permissions, task tracking and the model gateway, so adding an agent
never means duplicating streaming or persistence.

## Contract

`apps/api/app/agents/base.py`:

```python
@dataclass
class Agent:
    slug: str
    name: str
    tagline: str
    description: str
    accent: str
    capabilities: list[str]
    tools: list[str]
    system_prompt: str
    samples: list[str]
    approval_required: list[str]
    model_role: str
    keywords: list[str]

    def plan(self, message: str) -> list[AgentPlanStep]: ...
    async def gather(self, message: str, context: dict) -> ToolResult | None: ...
```

`plan()` returns visible steps. A step may declare a tool; the orchestrator calls
the agent’s `gather()` once and injects the result into the prompt.

## Registry (Foundation v0.1)

| Slug | Name | Model role | Tools | Approval gates |
|---|---|---|---|---|
| `core` | ORBITO Core | smart | search, browser, docs, files | none |
| `career` | Career | smart | search, browser, docs | submit application, send email |
| `research` | Research | reasoning | search, browser | none |
| `study` | Study | reasoning | documents | none |
| `coding` | Build | coding | filesystem, browser | shell, write files, push |
| `automation` | Automate | coding | search, browser, filesystem | enable workflow, notify |

## Routing

1. Explicit `agent` in the request wins (except `auto`/`core` fall back to
   scoring).
2. Otherwise each specialist scores keyword hits in the message (multi-word
   keywords weigh 2).
3. Highest score ≥ 1 wins; otherwise `core`.

Routing is intentionally deterministic: it is cheap, testable and shown in the
UI. A model-assisted classifier can replace `AgentRegistry.select` later.

## Execution

```text
Understanding your request
[Selecting the <Agent> agent]          # skipped for core
…agent-specific plan…
Composing your answer
```

Each step is persisted in `task_steps` and streamed as `step.updated`. Tool
output is truncated into the step detail (auditable) and passed to the model as
`tool_context`. Sources are streamed separately and attached to the message.

Limits are structural in v0.1: one specialist per request, one tool pass per
plan, one model invocation, no recursive delegation. Budgets/deadlines join in
Phase 3.

## Personas

Each agent carries a focused system prompt. All of them inherit the ORBITO base
prompt: be concrete, never invent tool results, cite sources, never claim an
external action succeeded, respect approval gates.

## Memory

- Conversation history: last 14 messages are replayed into context.
- Long-term memory: up to 8 items injected into the system prompt.
- Explicit capture: messages starting with “remember …” are stored.
- Users can inspect and delete memories in Settings → Memory.

Workspace-scoped memory and vector retrieval land in Phase 3/5.

## Permissions

Agent approval lists are advisory to the prompt; enforcement lives in
`core/permissions/policy.py` and (Phase 3) the approval queue. Never let a
prompt be the security boundary.

## Adding an agent

1. Subclass `Agent` in `app/agents/<slug>/agent.py` (or `specialists.py` for a
   thin agent).
2. Declare capabilities, tools, keywords, approvals, model role, prompt.
3. Register it in `ALL_AGENTS`.
4. Add a `fallbackAgents` entry in `apps/web/src/lib/agents.ts`.
5. Add a routing test and a mock end-to-end test.

## Testing an agent

```bash
cd apps/api
.venv/bin/pytest tests/test_orchestrator.py -q
```

Assert: routing picks the expected slug, the plan has steps, `done` contains a
non-empty message, and usage tokens are recorded.
