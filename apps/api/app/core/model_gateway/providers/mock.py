"""Offline provider.

ORBITO must remain demoable without a single API key. The mock provider streams a
deterministic, agent-aware answer derived from the plan and tool results, so the
full orchestration loop can be exercised in tests, CI, and fresh clones.

It is explicitly labelled as a mock in the UI and never claims live actions.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.core.model_gateway.providers.base import BaseProvider, estimate_tokens
from app.core.model_gateway.schemas import (
    GenerationRequest,
    ModelSpec,
    StreamEvent,
    Usage,
)


class MockProvider(BaseProvider):
    name = "mock"
    capabilities = ("fast", "smart", "reasoning", "coding", "vision", "local")

    @property
    def configured(self) -> bool:
        return True

    def _compose(self, request: GenerationRequest) -> str:
        agent = str(request.metadata.get("agent") or "core")
        tool_context = str(request.metadata.get("tool_context") or "").strip()
        last_user = next(
            (m.content for m in reversed(request.messages) if m.role == "user"),
            "this request",
        )
        goal = last_user.strip().splitlines()[0][:180]

        intro = {
            "career": "Here is a focused career plan based on what you shared.",
            "research": "I mapped the request into a research brief you can act on.",
            "study": "Let's turn this into a study plan you can start today.",
            "coding": "Here is an implementation path, with the risky parts called out.",
            "automation": "Here is a safe automation design you can approve step by step.",
        }.get(agent, "Here is how I would take this forward.")

        lines = [f"{intro}\n", f"**Goal:** {goal}\n"]

        if tool_context:
            lines.append("**What the tools returned**\n")
            lines.append(f"{tool_context[:1400].strip()}\n")

        if agent == "career":
            lines += [
                "**Next actions**\n",
                "1. Upload your CV so matching can use real experience, not keywords.",
                "2. Confirm target locations, seniority, and remote policy.",
                "3. I will score each role against your CV and draft tailored bullets.",
                "",
                "**Ready for approval**\n",
                "Application submission is always gated — nothing is sent until you approve it.",
            ]
        elif agent == "research":
            lines += [
                "**Synthesis**\n",
                "- Group findings by theme, then by evidence strength.",
                "- Keep the URL and retrieval date attached to every claim.",
                "- Flag anything that needs a second source before you rely on it.\n",
                "**Export options**\n",
                "Structured JSON, CSV, or a shareable brief. Add a domain allowlist before "
                "running this at scale.",
            ]
        elif agent == "study":
            lines += [
                "**A 5-day path**\n",
                "1. Diagnostic: 10 questions to find the real gaps.",
                "2. Two focused blocks per day, 45 minutes each, with active recall.",
                "3. Daily flashcard review (10 minutes) and one past-paper section.",
                "4. Day 5: timed mock, then a targeted review of misses.\n",
                "Upload the source PDF and I will ground this in the actual material.",
            ]
        elif agent == "coding":
            lines += [
                "**Plan**\n",
                "1. Reproduce with a failing test.",
                "2. Isolate the smallest change that makes it pass.",
                "3. Run the suite, then review for boundary and error-path gaps.\n",
                "```bash\n# generated commands run in a sandbox, never on the host\n```\n",
                "Shell execution stays restricted until you approve a sandbox run.",
            ]
        elif agent == "automation":
            lines += [
                "**Workflow draft**\n",
                "1. Trigger: schedule or webhook.",
                "2. Steps: fetch → validate → transform → notify.",
                "3. Guardrails: timeout, retry budget, and a dry-run before enabling.\n",
                "Sending email or changing external systems requires explicit approval.",
            ]
        else:
            lines += [
                "**Suggested next step**\n",
                "Pick one concrete outcome for this turn — a file, a shortlist, a report — "
                "and I will execute it with the right agent and tools.\n",
            ]

        lines.append(
            "_Offline model active. Add a provider key in Settings → AI Models to route "
            "this task to Gemini, GPT, Claude, Mistral, or a local Ollama model._"
        )
        return "\n".join(lines)

    async def stream(
        self, spec: ModelSpec, request: GenerationRequest
    ) -> AsyncIterator[StreamEvent]:
        text = self._compose(request)
        prompt_tokens = sum(estimate_tokens(m.content) for m in request.messages)
        completion_tokens = estimate_tokens(text)

        yield StreamEvent(
            type="start",
            provider=self.name,
            model=spec.model,
            role=spec.role,
            fallback_used=bool(request.metadata.get("fallback_used")),
        )

        # Stream in small word groups so the UI timeline feels alive.
        buffer: list[str] = []
        for token in text.split(" "):
            buffer.append(token)
            if len(buffer) >= 4:
                chunk = " ".join(buffer) + " "
                buffer.clear()
                yield StreamEvent(type="delta", text=chunk)
                await asyncio.sleep(0.012)
        if buffer:
            yield StreamEvent(type="delta", text=" ".join(buffer))

        yield StreamEvent(
            type="done",
            provider=self.name,
            model=spec.model,
            role=spec.role,
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
            finish_reason="stop",
        )
