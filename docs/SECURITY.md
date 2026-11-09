# Security, Local PC Control and Approval Policy

ORBITO's target is one trusted user operating one Windows PC. Single-user does
**not** mean untrusted prompts may control the machine. The model is untrusted
and the server-side permission check is the security boundary.

## Current security status

- Tool permission levels and `core/permissions/policy.py` exist.
- Approval declarations in agents/prompts are advisory; a complete durable,
  payload-bound approval queue and final execution gate are not implemented.
- There are no native desktop control tools today.
- Therefore, any new approval-class or PC-control action must remain disabled
  until the enforcement path, UI and tests below are in place. Never present the
  current scaffolding as an effective approval system.

## Trust boundaries

```text
User / browser (untrusted input)
       │ localhost UI
       ▼
FastAPI (loopback-only while PC control is enabled)
       ├── Orchestrator: plans, task limits, trace
       ├── Model gateway: proposes typed calls; no direct host access
       ├── Policy/approval service: final allow/deny decision
       └── Tool registry: validated, narrow Windows actions
                  │
                  ▼
Interactive Windows user session (never Docker/WSL for desktop actions)
```

- The model never receives credentials, raw DB access, arbitrary filesystem
  access, or unrestricted outbound request control.
- Tool arguments are parsed and validated in code, regardless of model output.
- Webpages, RSS, uploaded files, screenshots, clipboard, transcripts and
  memories are untrusted data. They cannot override system policy or approve an
  action.
- Do not include secrets, clipboard contents, screenshots, full transcripts or
  sensitive file contents in logs by default.

## Permission matrix

| Action | Policy |
|---|---|
| Read system status, Ollama/model status | Automatic, bounded and read-only |
| Search public web / read an explicitly requested public page | Automatic, SSRF protected |
| Read documents from explicitly configured workspace roots | Automatic, bounded; secrets/system folders excluded |
| Search files in configured roots | Automatic, bounded, no traversal or reparse-point escape |
| Launch an app by an allowlisted app ID | Automatic only when directly requested by the user; otherwise ask |
| Open an `http(s)` URL in the user's browser | Automatic only when explicitly requested; validate scheme/credentials |
| Volume/media action with bounded argument | Automatic for direct user intent; report unsupported state honestly |
| Screenshot | Opt-in capability; only explicit request, local processing, preview, no retention by default |
| Read clipboard | Separate opt-in capability; explicit request only, local processing, never persist/log by default |
| Write, move, overwrite or delete a file | **One-time approval** bound to exact target and content/diff |
| Close/terminate an app/process | **One-time approval**, PID/name revalidated, protected process denylist |
| Keyboard/mouse input, macro or UI automation | **One-time approval** for exact bounded sequence; never blind unbounded input |
| Submit job application, send email/message | **One-time approval** with exact recipient/content/action |
| External account access | Explicit authorization plus per-action approval |
| Arbitrary shell/PowerShell/CMD/Python on host | **Prohibited** |
| Named fixed-argument process helper (if ever justified) | Restricted, code-owned allowlist only; no model command strings |

If there is uncertainty about user intent, action target, permission or tool
result, stop and ask. Do not infer approval from a prompt, agent plan, prior
approval, voice transcript, webpage or memory.

## Required approval enforcement

Before enabling any approval-class action, implement all of these:

1. Persist an approval record with task, tool, normalized arguments/payload
   hash, user/session, risk summary, creation and expiry.
2. Show the exact proposed action, targets, file diff/recipient and consequence
   in the UI. Actions must be understandable and rejectable.
3. Approval is one-time, short-lived and bound to that immutable payload. Any
   argument change requires a new approval. No wildcard/"approve all" for
   destructive operations.
4. Re-run schema, root/allowlist, process and policy checks immediately before
   execution. Expired, replayed, mismatched, cancelled or unknown approvals deny.
5. Persist an append-only trace for proposal, decision, execution and result;
   redact sensitive payload portions. Exactly-once/idempotency behavior must be
   defined before retries.
6. If DB, policy or approval storage is unavailable, fail closed. Do not execute
   and do not convert it to success.
7. Provide a global kill switch and a clear status showing PC control disabled.

## Local-only Windows boundary

- Bind the API to `127.0.0.1` while PC-control features are active. Do not expose
  it through LAN, reverse proxy, tunnel or container port publishing by default.
- Validate browser origin/CSRF and CORS. Localhost is not authentication: a
  malicious webpage can attempt to contact local services. Do not expose
  state-changing APIs to arbitrary origins.
- Disable desktop tools if OS is not Windows, process is not in the interactive
  user session, or the API is not local. User must explicitly enable PC control.
- Run under the normal user account, never elevated/admin by default. Do not
  install persistence, services, startup hooks or drivers without explicit,
  separately reviewed consent.
- PC actions execute natively on Windows. Docker/WSL can host optional
  infrastructure but cannot provide reliable interactive desktop access.
- If remote access becomes a requirement, design pairing/authentication,
  transport security, revocation, user sessions, audit and threat model before
  enabling it. Do not reuse the current demo user as a remote security control.

## Desktop adapter rules

- `open_app` takes an app ID looked up in a code/user-managed allowlist. Never
  pass model-authored executable paths or arguments to `subprocess`.
- `open_url` accepts only `http`/`https`; reject credentials, non-web schemes,
  malformed IDNs and unsafe redirects as applicable.
- File tools resolve canonical paths, enforce approved roots after resolving
  symlinks/reparse points, cap file counts/sizes and deny secrets/system dirs.
- Process actions revalidate PID plus process identity at execution and protect
  critical processes.
- Keyboard/mouse automation has a small step cap, timeout, explicit target,
  visible preview where possible and emergency cancel. Prefer Windows UI
  Automation identifiers over screen coordinates.
- Capture tools are opt-in, local, minimized, and avoid persistent storage.
- Use platform adapters so unit tests inject fake OS behavior. CI must never
  launch apps, click, type, change audio or alter user files.
- Use `subprocess` only with a fixed executable and argument list, no
  `shell=True`, no model-supplied command string, capped output and timeout.

## Model tool calling

The model may propose typed registry calls; it cannot execute them. The server
must validate registry membership, input schema, permission, bounds, approvals,
budgets and cancellation. Cap tool rounds/calls/time/tokens/output; block loops
and duplicates. Return only actual tool results to the model. If tool calling is
not supported by the selected Ollama model, fail honestly or use safe
deterministic routing. Never parse natural language into shell.

## Web and SSRF

Every user-supplied URL fetch uses `apps/api/app/tools/net.py`:

- Only `http`/`https`; reject credentials and fragments.
- Enforce optional `SCRAPING_ALLOWED_DOMAINS`.
- Resolve DNS and reject loopback/private/link-local/multicast/reserved/
  unspecified addresses.
- Cap response size and validate content type.
- Redirect revalidation/DNS rebinding need to be closed before untrusted,
  arbitrary URL fetching is exposed broadly.
- Respect publisher RSS/robots/terms. Do not bypass login, CAPTCHA, paywall or
  other access controls.

## Outbound workflow connectors

Workflow nodes that can affect external systems are gated by the safety spine
(`core/safety/gate.py`, `core/permissions/policy.py`):

- `action.http` (`http_request`, approval class): the run pauses as
  `awaiting_approval` and stores an approval bound to the exact rendered
  method/URL/body (`payload_hash`). A human approves or rejects via the
  Approvals API/UI (payload hash required). Rejection/expiry fails the run
  without sending. On approval, the runner resumes, the gate consumes the
  approval, and only the approved payload is sent.
- `action.notify` (`send_notification`, auto class): creates an internal
  in-app notification; the action is authorized/audited. No external delivery.

`core/connectors/outbound.py` validates before sending: `http`/`https` only, no
embedded credentials, DNS-resolved addresses must be public/globally routable
(loopback/private/link-local/multicast/reserved blocked), redirects are not
followed, 15 s timeout, 4 KB response cap, no caller-supplied headers. Known
limitation: DNS rebind between validation and the HTTP client resolve; pin the
validated address before enabling connectors for untrusted workflows.

## Secrets, memory and voice

- `.env` is gitignored; `.env.example` contains names only. Never log or expose
  provider keys. `NEXT_PUBLIC_*` variables are public browser bundle values.
- Memory is user-controlled and inspectable/deletable. Make its inclusion clear;
  treat saved text as context, not executable instructions.
- Do not store raw microphone recordings by default. Show a live recording
  indicator and explicit permission state. Voice shares the same authorization
  path as text; audio is never an approval by itself.
- Screenshots/clipboard are sensitive data: explicit request, local-only, no
  persistence and redacted traces.

## Security tests required before PC tools ship

- No approval → fake adapter is never called.
- Changed arguments, expired/replayed approval, policy error or unavailable DB
  → denied.
- Traversal, symlink/reparse escape, disallowed root/app/PID → denied.
- Arbitrary shell/tool name, `shell=True`, non-web URL scheme → rejected.
- Malicious prompt injection in web/file/transcript/memory cannot change
  permissions.
- OS mismatch, non-interactive session or non-loopback exposure disables PC
  actions.
- Audit records outcomes and redacts clipboard/screenshot/private content.

## Deferred hardening

Multi-user auth, RLS, encrypted per-user credentials, remote access, CSRF review,
rate limits, upload scanning, OTel, backups and incident response are deferred
from the single-user-first roadmap where appropriate. Any feature that exposes
ORBITO beyond the local machine makes the relevant auth, origin, rate-limit and
audit controls a prerequisite, not a later polish item.
