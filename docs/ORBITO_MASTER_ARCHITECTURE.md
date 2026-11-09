# ORBITO Master Architecture

This document defines the build-level architecture for ORBITO as a **single-user,
local-first personal AI operating system**. Its first-class goal is a safe
Windows desktop assistant. See `IMPLEMENTATION_PLAN.md` for the authoritative
sequencing and acceptance criteria.

## Product principle

ORBITO should be a live AI operating system, not a static dashboard or isolated chatbot. The UI should reflect real system state, not synthetic activity.

The user-facing loop is: **listen → understand → propose → authorize → act →
report**. The current text chat and task trace are the foundation. PC control,
enforced approvals, general model tool calling and voice are still planned work.

## Core layers

### 1. Command Center

The main interface for understanding what is happening across the system.

Responsibilities:
- show active agents
- show model activity
- show running tasks
- show resource health
- show approvals and notifications
- provide a central AI command surface

### 2. AI Core

The orchestration brain of the product.

Responsibilities:
- classify intent
- plan work
- select agents
- select models
- assign tools
- maintain execution state
- route failures and approvals
- persist results

### 3. Agent System

Specialized agents should be real runtime entities with traceability, tool access, permissions, and model assignments.

### 4. Task Manager

A durable task lifecycle is required for every user-visible action and background process.

Lifecycle:
- created
- queued
- running
- waiting for approval
- paused
- failed
- cancelled
- completed

### 5. Model Hub

This is the model orchestration and routing system.

Responsibilities:
- local-first model resolution
- provider fallbacks
- cost tracking
- model health
- capability-aware routing

### 6. Discovery systems

- News intelligence
- Jobs intelligence
- Web intelligence
- Scraping pipeline

These all share a common extraction and normalization model but serve distinct product experiences.

### 7. Knowledge and learning systems

- Education center
- Knowledge base
- Memory system
- document retrieval and citations

### 8. Media and interaction systems

- voice
- transcription
- image and vision
- video understanding
- generation pipelines

### 9. Automation system

Schedules, workflows, triggers, and execution history.

### 10. System Center

This includes machine telemetry, process awareness, resource health, and local model resource control.

### 11. Security Center

Permissions, approval flow, secret handling, audit log, and system boundaries.

## System boundary rules

- API is the translation layer.
- Core owns the orchestration logic and business rules.
- Agents implement specialized behavior.
- Tools own safe execution and validation.
- Model gateway owns provider access.
- Database owns persistence.
- UI reflects system state rather than manufacturing fake activity.
- Desktop control runs natively in the interactive Windows session, on loopback
  by default. Docker/WSL is not the desktop executor.
- The model may propose a typed registry call; server policy and a final
  execution gate decide whether it runs. No prompt grants a permission.
- Arbitrary model-generated shell on the host is prohibited.
- Clipboard, screen and microphone are explicit opt-in capabilities with
  minimization and no retention by default.

## Execution model

All work should be tracked with:
- task identity
- parent-child relationships where needed
- agent identity
- model identity
- tool call trace
- status events
- output references
- failure and retry details

## Real-data requirement

Every command center widget must be backed by real data sources:
- active agents by runtime registry
- running tasks by task store
- model state by actual provider state
- system health by telemetry collector
- news and jobs by ingestion pipeline
- approvals by approval service

## Build order

1. Verify real local Ollama inference end-to-end
2. Enforced one-time approval, audit trail, loopback guard and kill switch
3. Native Windows read-only/allowlisted PC tools
4. Typed model tool-calling loop with strict bounds
5. Approved PC state changes and durable opt-in workflows
6. Push-to-talk local STT/TTS; wake word later
7. User-controlled memory and local retrieval/citations
8. Proactive briefings and secondary intelligence modules

Multi-user authentication, billing, RLS and remote PC control are deferred until
real usage calls for them. Their deferral does not relax local security.

## Design principle

ORBITO should feel like a premium operating system without becoming cluttered or synthetic. The product works when complexity is visible in the right places and hidden in the right boundaries.
