# ORBITO Roadmap — Personal Jarvis

ORBITO's primary goal is a useful **single-user, local-first assistant that can
safely operate the owner's Windows PC**. This roadmap replaces the earlier
multi-user/product-platform-first sequence. The detailed, testable backlog and
acceptance criteria live in [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).

## Current foundation — present, not the destination

The repo has a working web/API foundation, Ollama Model Hub, chat and task
traces, declarative agents, web/filesystem/document tools, basic user-controlled
memory, system telemetry, news/markets and a Three.js Planet. These are useful
surfaces, but **PC control, enforced approvals, general model tool calling,
push-to-talk, speech and semantic document retrieval are not complete**.

The `voice` route is a UI shell. Tool permissions exist, but the durable
approval/execution loop is not yet an enforcement boundary. Do not tell users
that ORBITO controls their desktop or can safely execute a proposed action until
the capability is implemented and verified on Windows.

## Jarvis sequence

| Order | Milestone | Exit condition |
|---|---|---|
| 0 | Prove local runtime | Real chat task trace confirms Ollama/model, not just provider health |
| 1 | Safety spine | One-time approve/reject, payload-bound approvals, enforced policy, audit trail, local-only guard and kill switch |
| 2 | Windows PC tools | Safe read-only and allowlisted app/URL/media actions work natively; explicit opt-in for screen/clipboard |
| 3 | Model tool calling | Local model selects typed tools; server validates, authorizes, bounds and traces each call |
| 4 | Reliable control/workflows | Approved writes/UI actions, undo where possible, durable queue, opt-in schedules |
| 5 | Push-to-talk | Local STT/TTS, visible recording, editable transcript, interrupt, same permissions as text |
| 6 | Memory and RAG | Local embeddings, user-selected files, inspectable citations and deletion/reindex |
| 7 | Proactive assistance | Briefings/reminders/workflows only with source freshness, user controls, approvals and pause-all |

See `IMPLEMENTATION_PLAN.md` for checklists, Windows constraints and security
requirements. No phase may claim success from a mock, a prompt instruction or a
UI animation alone.

## Secondary capabilities

News, markets, scraping, jobs, education, Planet/globe, video, multi-agent
planning and the broader System Center remain in the product. Advance them when
they support the Jarvis loop or a clear user need; they must not delay the
approval gate, desktop tools, tool calling or push-to-talk.

## Deferred by design

- Multi-user auth, registration, billing and tenant-specific RLS.
- Cloud deployment and remote PC control.
- LangGraph migration, microservices, LiveKit-first voice and broad OTel work.
- Always-on wake word until push-to-talk is reliable, opt-in and privacy-tested.

These are not necessarily permanent non-goals. Revisit them when actual usage
requires them. The security invariants in `SECURITY.md` are not deferrable.

## Always true

- No arbitrary model-generated shell or code on the host.
- No sensitive action executes because a prompt says it is safe.
- PC control is local-only by default and runs in the interactive Windows user
  session, not in Docker/WSL.
- Every action has a real result, a visible status and a trace; errors remain
  errors, not fabricated success.
- One logical milestone per commit; push coherent commits when the remote is
  available.
