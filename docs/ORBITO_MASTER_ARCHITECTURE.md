# ORBITO Master Architecture

This document defines the build-level architecture for ORBITO as a personal AI operating system.

## Product principle

ORBITO should be a live AI operating system, not a static dashboard or isolated chatbot. The UI should reflect real system state, not synthetic activity.

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

1. Foundation and repo conventions
2. Model gateway
3. Agent execution and task lifecycle
4. System health and observability
5. Command center dashboard
6. Jobs and news discovery
7. Knowledge and education
8. Automation and media workflows
9. Security hardening and production readiness

## Design principle

ORBITO should feel like a premium operating system without becoming cluttered or synthetic. The product works when complexity is visible in the right places and hidden in the right boundaries.
