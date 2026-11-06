"""Concrete agents.

Specialists are intentionally thin: planning, tool use and persistence live in
the orchestrator so behaviour stays uniform and auditable.
"""

from __future__ import annotations

from typing import Any

from app.agents.base import Agent, AgentPlanStep
from app.core.model_gateway.registry import registry
from app.tools.base import ToolResult
from app.tools.registry import tools


class CareerAgent(Agent):
    def plan(self, message: str) -> list[AgentPlanStep]:
        return [
            AgentPlanStep("Matching roles to your profile", tool="web_search"),
            AgentPlanStep("Scoring fit and gaps"),
            AgentPlanStep("Drafting the next actions"),
        ]

    async def gather(self, message: str, context: dict[str, Any]) -> ToolResult | None:
        tool = tools.get("web_search")
        if not tool:
            return None
        return await tool.run(
            query=f"{message} jobs hiring", limit=5
        )


class ResearchAgent(Agent):
    def plan(self, message: str) -> list[AgentPlanStep]:
        return [
            AgentPlanStep("Searching the web", tool="web_search"),
            AgentPlanStep("Extracting and deduplicating findings"),
            AgentPlanStep("Synthesizing the brief"),
        ]

    async def gather(self, message: str, context: dict[str, Any]) -> ToolResult | None:
        tool = tools.get("web_search")
        if not tool:
            return None
        return await tool.run(query=message, limit=6)


class StudyAgent(Agent):
    def plan(self, message: str) -> list[AgentPlanStep]:
        return [
            AgentPlanStep("Checking your source material"),
            AgentPlanStep("Mapping the learning path"),
            AgentPlanStep("Building recall material"),
        ]


class CodingAgent(Agent):
    def plan(self, message: str) -> list[AgentPlanStep]:
        return [
            AgentPlanStep("Inspecting the workspace"),
            AgentPlanStep("Designing the change"),
            AgentPlanStep("Writing the implementation plan"),
        ]


class AutomationAgent(Agent):
    def plan(self, message: str) -> list[AgentPlanStep]:
        return [
            AgentPlanStep("Defining the trigger"),
            AgentPlanStep("Drafting the step graph"),
            AgentPlanStep("Checking guardrails and approvals"),
        ]


class CoreAgent(Agent):
    def plan(self, message: str) -> list[AgentPlanStep]:
        return [
            AgentPlanStep("Understanding the request"),
            AgentPlanStep("Choosing the right tools"),
            AgentPlanStep("Composing the response"),
        ]


career = CareerAgent(
    slug="career",
    name="Career",
    tagline="Find jobs, tailor applications, track opportunities.",
    description=(
        "Searches roles, matches them against your CV, drafts tailored bullets and cover "
        "letters, and tracks every application. Submissions always wait for approval."
    ),
    accent="violet",
    capabilities=["Job discovery", "CV matching", "Cover letters", "Application tracker"],
    tools=["web_search", "browser", "documents"],
    approval_required=["Submit an application", "Send an email"],
    model_role="smart",
    keywords=[
        "job",
        "jobs",
        "career",
        "resume",
        "cv",
        "apply",
        "application",
        "interview",
        "hiring",
        "salary",
        "recruiter",
    ],
    samples=[
        "Find 50 AI engineering jobs in Canada",
        "Score these roles against my CV",
        "Write a cover letter for this job",
    ],
    system_prompt=(
        "You are ORBITO Career. Be concrete and evidence-led. Never invent experience; "
        "mark gaps explicitly. Always attach sources to job claims. Application submission "
        "is gated behind human approval."
    ),
)

research = ResearchAgent(
    slug="research",
    name="Research",
    tagline="Scrape & gather information from the web.",
    description=(
        "Runs web research, site scraping, lead and competitor analysis, deduplicates "
        "sources, and exports structured results."
    ),
    accent="mint",
    capabilities=["Web research", "Scraping", "Competitor analysis", "Structured export"],
    tools=["web_search", "browser"],
    approval_required=[],
    model_role="reasoning",
    keywords=[
        "research",
        "scrape",
        "scraping",
        "crawl",
        "competitor",
        "leads",
        "market",
        "analyse",
        "analyze",
        "report",
        "sources",
        "data extraction",
    ],
    samples=[
        "Analyze these competitor websites",
        "Scrape product data from this URL",
        "Build a market brief with sources",
    ],
    system_prompt=(
        "You are ORBITO Research. Separate observed facts from inference. Cite every "
        "source with its URL. Report retrieval limits honestly and never fabricate data."
    ),
)

study = StudyAgent(
    slug="study",
    name="Study",
    tagline="Get help with homework, learn faster.",
    description=(
        "Explains concepts, reads PDFs, summarizes material, generates quizzes and "
        "flashcards, and builds study plans that adapt to your exam date."
    ),
    accent="blue",
    capabilities=["PDF understanding", "Tutoring", "Flashcards", "Study plans"],
    tools=["documents"],
    approval_required=[],
    model_role="reasoning",
    keywords=[
        "study",
        "exam",
        "learn",
        "explain",
        "tutor",
        "flashcard",
        "quiz",
        "lesson",
        "pdf",
        "homework",
        "revision",
        "course",
    ],
    samples=[
        "Explain this machine learning lesson",
        "Make a 7-day study plan for my exams",
        "Quiz me on this PDF",
    ],
    system_prompt=(
        "You are ORBITO Study. Teach with worked examples and active recall. Adapt depth "
        "to the learner, check understanding, and ground answers in the uploaded material."
    ),
)

coding = CodingAgent(
    slug="coding",
    name="Build",
    tagline="Create code, debug projects, automate workflows.",
    description=(
        "Generates and reviews code, plans refactors, runs tests in an isolated sandbox, "
        "and works with Git. Host shell access is never granted to the model."
    ),
    accent="amber",
    capabilities=["Code generation", "Debugging", "Review", "Sandboxed tests"],
    tools=["filesystem", "browser"],
    approval_required=["Execute shell commands", "Write files", "Push to Git"],
    model_role="coding",
    keywords=[
        "code",
        "coding",
        "bug",
        "debug",
        "api",
        "function",
        "build",
        "website",
        "react",
        "python",
        "typescript",
        "git",
        "refactor",
        "test",
    ],
    samples=[
        "Build a landing page for my business",
        "Debug this failing test",
        "Review this API design",
    ],
    system_prompt=(
        "You are ORBITO Build. Prefer the smallest correct change. Show commands you "
        "would run, but remember execution happens in a sandbox after approval. Call out "
        "security, migration and rollback concerns."
    ),
)

automation = AutomationAgent(
    slug="automation",
    name="Automate",
    tagline="Workflows that run while you don't.",
    description=(
        "Builds scheduled and triggered workflows with conditions, retries, notifications, "
        "and dry-runs before anything is enabled."
    ),
    accent="rose",
    capabilities=["Scheduled tasks", "Multi-step flows", "Monitoring", "Notifications"],
    tools=["web_search", "browser", "filesystem"],
    approval_required=["Enable a live workflow", "Send notifications externally"],
    model_role="coding",
    keywords=[
        "automate",
        "automation",
        "workflow",
        "schedule",
        "scheduled",
        "every day",
        "monitor",
        "notify",
        "trigger",
        "webhook",
        "cron",
    ],
    samples=[
        "Run a job search every Monday",
        "Monitor this page and notify me",
        "Automate my weekly report",
    ],
    system_prompt=(
        "You are ORBITO Automate. Design idempotent, observable workflows with explicit "
        "trigger, retry budget, failure path and dry-run. Never enable external effects "
        "without approval."
    ),
)

core = CoreAgent(
    slug="core",
    name="ORBITO Core",
    tagline="Your always-on AI companion.",
    description=(
        "Understands intent, delegates to the right specialist, and keeps one coherent "
        "workspace across chat, files, and memory."
    ),
    accent="violet",
    capabilities=["Intent routing", "Multi-agent execution", "Memory", "Task tracking"],
    tools=["web_search", "browser", "documents", "filesystem"],
    approval_required=[],
    model_role="smart",
    keywords=[],
    samples=[
        "What should we get done today?",
        "Summarize this article",
        "Plan my week",
    ],
    system_prompt=(
        "You are ORBITO Core, the user's personal AI operating system. Be direct, useful "
        "and honest about what you did. If a task needs a specialist, say which one and why."
    ),
)

ALL_AGENTS: dict[str, Agent] = {
    agent.slug: agent
    for agent in (core, career, research, study, coding, automation)
}

# Keep registry imports meaningful for the model role validation.
assert all(agent.model_role in registry.roles for agent in ALL_AGENTS.values())
