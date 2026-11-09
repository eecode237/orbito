---
name: ORBITO Windows PC Control
description: "Use when designing or implementing any ORBITO feature that reads or acts on the user's Windows PC: launch apps/URLs, search files, screen capture, clipboard, volume/media, file changes, process control, keyboard/mouse, shell-like operations, or desktop approval UI."
---

## Required reading

- `docs/IMPLEMENTATION_PLAN.md` (Jarvis phase and acceptance criteria)
- `docs/SECURITY.md` (authoritative policy)
- `docs/ARCHITECTURE.md` and `docs/AGENTS.md`
- `.opencode/skills/orbito-security-review/SKILL.md`
- `.opencode/skills/orbito-api-feature/SKILL.md` for endpoints/tests

## Current state

There are no native Windows PC-control tools yet. Existing tools are web
search/browser/documents/workspace filesystem and a non-executing delete
placeholder. Agent keyword routing + `gather()` is **not** model tool calling.
The approval policy module is scaffolding, not a durable, enforced approval
queue. Do not say PC control or approvals are shipped until the final executor,
UI and Windows acceptance test work.

## Non-negotiable boundary

- Windows native in the interactive logged-in user session; not Docker or WSL.
- API binds `127.0.0.1` while desktop control is enabled. Fail closed on another
  OS, non-loopback exposure, non-interactive session, disabled capability or
  policy/approval store error. Remote control is out of scope until separately
  designed with authentication, pairing, origin/CSRF protection and revocation.
- Use least privilege; never elevate/admin by default.
- Model output is an untrusted proposal, never a command. Schema-validate,
  canonicalize and bound arguments in the tool and recheck policy at execution.
- Never run model-generated PowerShell, CMD, Python, scripts, `shell=True`,
  arbitrary paths or arbitrary executable arguments on the host.
- Unknown tool/action means deny. No approval means no execution. UI optimism is
  not authorization.
- Every action gets a task/event trace and a real result. Add a global kill
  switch. Never claim success before the OS adapter confirms success.

## Tool classification

| Capability | Default |
|---|---|
| Read system status/model status | Auto, read-only |
| Search files | Auto but bounded to explicit roots; skip secrets/system paths |
| Launch app | Auto only for explicit user request and an allowlisted app ID |
| Open URL | Only validated `http(s)`; auto only for explicit user request |
| Set volume/media | Bounded enum/value and explicit user request |
| Screenshot | User opt-in + explicit request; local preview, no retention/logging |
| Clipboard | Separate opt-in + explicit request; local only, never persisted |
| Write/move/overwrite/delete file | One-time approval tied to exact target/content diff |
| Close process/app | One-time approval, revalidate PID + identity, protect critical PIDs |
| Keypress/click/macro | One-time approval for an exact bounded plan; prefer UI Automation IDs |
| Shell/process | Arbitrary shell prohibited. Any future operation is a named code-owned fixed-argument allowlist function, restricted and approved. |

Voice inherits the exact same policy as text. A transcript or audio phrase is
never approval. Ambiguous intent results in a question, not an action.

## Implementation workflow

1. Build the safety spine first: one-time pending approval, payload hash, task,
   user/session, expiry, reject/cancel, replay protection, final revalidation,
   append-only audit events, fail-closed DB behavior and global kill switch.
2. Add typed tools with narrow adapters. Keep OS APIs in `apps/api/app/tools/`
   (or a documented lower-level desktop adapter module), not in routes/agents.
3. Prefer Windows UI Automation/accessibility identifiers. Use raw coordinates
   only for a narrowly bounded, user-visible, approved operation.
4. Add platform capability detection and UI states: unavailable, disabled,
   available, pending approval, denied, running, succeeded, failed, cancelled.
5. Unit-test against fake adapters. Do not perform real launches, clicks,
   keypresses, file writes or volume changes in CI. Manual Windows acceptance is
   required for the final milestone.
6. Keep the loopback/local-origin protections tested; localhost is not itself
   authentication and malicious websites can target local services.
7. Update `docs/IMPLEMENTATION_PLAN.md`, `docs/SECURITY.md`, `docs/AGENTS.md`,
   API contracts, UI contracts and this skill in the same milestone.

## Initial five demo flows

Only use these as end-to-end acceptance once implemented:

1. "Open Spotify" → app ID allowlist → actual process launch result.
2. "Open https://example.com" → validated URL and visible default-browser open.
3. "Set volume to 20" → clamp 0–100 and report measured state if supported.
4. "Find my latest PDF" → configured roots only, bounded results, no file read
   without user request.
5. "Take a screenshot" → explicit request + opt-in + local preview; no save by
   default.

For an action such as deleting a file, show the exact normalized path and diff,
wait for approval, then revalidate and execute once. If any step fails, report
failure without a success claim.
