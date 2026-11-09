---
name: ORBITO Jarvis Product Direction
description: Use when prioritizing ORBITO features, changing its roadmap, deciding whether to build a secondary module versus desktop/voice/memory capability, or defining acceptance criteria for the personal local-first assistant.
---

## Product north star

ORBITO is for one user on one trusted Windows PC. The core loop is:

**listen → understand → propose → authorize → act → report**

Make the system powerful through real, inspectable capabilities, not a growing
page count or fake activity. The source of truth is `docs/IMPLEMENTATION_PLAN.md`.

## Prioritization test

For each proposed feature, answer:

1. Does it advance the core personal assistant loop or a clear user-requested
   capability?
2. Is the data/action real and verifiable?
3. Does it depend on an approval, local security or runtime prerequisite that
   isn't implemented? Build the prerequisite first.
4. Can the feature work natively on the target Windows PC with current models
   and hardware? Benchmark rather than assuming.
5. Is the UI exposing real state, failures and permission? Avoid demo-only
   actions or fake success.
6. Is it safer/smaller to ship one narrow vertical slice than a broad framework?

## Priority order

1. Verify Ollama generated a real chat answer (provider/model on task trace).
2. Enforced, one-time, payload-bound approvals + audit + kill switch + loopback.
3. Native Windows PC tools: status, bounded file search, allowlisted app launch,
   validated URL open, volume/media; screenshot/clipboard opt-in.
4. Typed model tool-calling loop, validated/authorized by server, bounded and
   tested against the exact local model.
5. Approved state changes and reliable opt-in workflows.
6. Push-to-talk local STT/TTS; wake word later and opt-in.
7. User-controlled memory, local embeddings/RAG with citations.
8. Proactive briefings and secondary modules such as Planet/news/jobs.

## Defer unless requirements change

Multi-user auth/registration, billing, tenant RLS, remote PC control,
microservices, LangGraph migration, LiveKit-first voice and broad OTel
instrumentation. Their deferral does not weaken local security; remote access
specifically requires a new threat model and authentication/pairing design.

## Non-negotiable acceptance

- Never claim capability before a real end-to-end test.
- No arbitrary model-generated shell or code runs on the host.
- Prompt instructions and model tool proposals never grant permission.
- Actions are traced and report confirmed results only.
- UI handles offline, unsupported, denied, pending, failed and cancelled states.
- Every behavior change includes tests and documentation. Commit by logical
  milestone and push when the remote is available.
