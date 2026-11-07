---
name: orbito-architecture
description: "Use when planning, building, debugging, or extending ORBITO features. Covers architecture boundaries, model routing, task execution, system monitoring, security, and the staged build order for the personal AI operating system."
---

# ORBITO architecture skill

Use this skill when a task touches:

- the overall ORBITO system design
- agent orchestration and task execution
- model gateway and provider routing
- system monitoring and telemetry
- scraping, jobs, news, knowledge, or study workflows
- deployment architecture or security boundaries

## Core rules

- ORBITO is a real operating system, not a single chatbot.
- The AI core orchestrates work; individual agents are specialists.
- All model access goes through app/core/model_gateway.
- Keep the import direction: api → core → agents → tools.
- Use real task records, execution traces, and approval gates.
- Do not invent running agents, model activity, or success states.

## System map

- Command Center: live activity, task overview, model summary, approvals
- AI Core: intent routing, planning, execution, model selection, approvals
- Agent System: specialist agents and subagent execution
- Task Manager: task lifecycle, progress, errors, retries, outputs
- Model Hub: local and cloud providers, model routing, usage and cost
- News Intelligence: global discovery and synthesis
- Jobs Intelligence: discovery, matching, tracking, and applications
- Education Center: PDF, study, notes, quizzes, tutoring
- Knowledge Intelligence: memory, documents, retrieval, graphs
- Web Intelligence: search, crawling, extraction, and browser automation
- Voice and Media: voice, transcription, vision, video, generation
- Automation Center: triggers, schedules, and workflow execution
- System Center: CPU, RAM, disk, GPU, battery, process health
- Security Center: permissions, approvals, credential handling, audit logs

## Build order

1. Foundation and architectural boundaries
2. Model gateway and provider fallback
3. Agents and execution lifecycle
4. System telemetry and observability
5. Dashboard + Command Center
6. Scraping, jobs, and news intelligence
7. Knowledge and study workflows
8. Automation and media workflows
9. Security hardening and production readiness

## Prompting expectation

When implementing a feature:

- identify the correct layer first
- preserve existing repo conventions
- add tests for changed behavior
- keep outputs and states honest
- document architecture changes in the repo docs if they modify the system model

## Repo checkpoints

- AGENTS.md is the authoritative start point for repo work.
- docs/ARCHITECTURE.md describes the system shape and boundaries.
- docs/MODELS.md describes provider and fallback behavior.
- docs/AGENTS.md describes agent contracts and execution model.
- docs/SECURITY.md defines trust boundaries and approval expectations.
