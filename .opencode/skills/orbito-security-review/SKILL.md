---
name: ORBITO Security Review
description: Use when a change touches approvals, shell or file operations, email or submissions, outbound URL fetching, uploads, workspace file access, secrets or .env handling, memory storage, or any action that writes data or acts on the user's behalf.
---

## Permission matrix (`docs/SECURITY.md`)

| Action | Policy |
| --- | --- |
| Search or read public pages | Automatic |
| Generate drafts, plans, summaries | Automatic |
| Submit an application, send email or notification | Approval required |
| Write or delete a file | Approval required |
| Access an external account | Explicit authorization |
| Run shell commands | Restricted sandbox only. No model-generated shell on the host. |

## Checklist for any sensitive action

- [ ] The tool declares its permission level. Agent prompts list approval-required actions (`build_system_prompt` does this).
- [ ] The endpoint refuses execution without an approved approval record. Deletion endpoints already refuse unapproved execution, per SECURITY.md.
- [ ] An audit or task event is written (`repo.add_task_event`) with the action and outcome.
- [ ] Input validation lives inside the tool, not in the prompt.
- [ ] Be honest about gaps. The durable approval queue and audit records are not complete today. Don't describe them as shipped.

For the current local Jarvis scope, **do not enable a new approval-class action
until the durable approval queue and final server-side execution gate are
actually implemented**. The existing policy module and prompt declarations are
not sufficient. See `docs/IMPLEMENTATION_PLAN.md` and `docs/SECURITY.md` for the
payload-bound one-time approval contract.

## Outbound URLs (SSRF)

Every user-supplied URL goes through `apps/api/app/tools/net.py`:

- Only `http` and `https`. Reject credentials and fragments.
- Enforce the optional allowlist `SCRAPING_ALLOWED_DOMAINS`.
- Resolve DNS. Every answer must be a public IP. Reject loopback, private, link-local, multicast, reserved, and unspecified addresses.
- Cap response size. Require an HTML or XML content type.

Known gap: redirects are followed without re-validation (Phase 4). Don't add a new fetch path that bypasses `net.py`.

## Files and uploads

- 25 MB upload cap. Sanitize filenames. Store under `.data/uploads`.
- Don't trust the recorded content type. Never execute uploaded files.
- Workspace access stays inside configured roots and rejects path traversal (`tools/filesystem.py`). Sensitive files such as `.env` are flagged in the tree listing.

## Windows PC-control rules

- Target one Windows user session; desktop tools run natively, not in Docker/WSL.
- Bind the API to loopback while PC actions are enabled; reject unsupported OS
  and non-local exposure. Localhost alone is not authentication: protect API
  actions against malicious browser origins and CSRF.
- `open_app` accepts an allowlisted app ID, never a model-supplied executable
  path. `open_url` accepts validated `http(s)` only. File search is bounded to
  configured roots.
- Screenshot/clipboard are sensitive opt-in tools, explicit-request only,
  local-only and non-retained by default. Microphone has a visible recording
  state; voice never gets more permissions than text.
- File mutation, app termination, key/mouse input and macros require approval.
- Arbitrary shell/PowerShell/CMD/Python on the host is prohibited. `shell=True`
  and model-generated command strings are prohibited. If a named process helper
  is later approved, keep it a fixed-argument code-owned allowlist entry.
- Test policies with fake OS adapters. Unit/integration tests must never click,
  type, launch apps, change volume or modify user files.

## Secrets and privacy

- `.env` is gitignored. `.env.example` lists names only.
- Never write keys to logs, prompts, API responses, or the frontend bundle. `NEXT_PUBLIC_*` values ship to the browser.
- Memory is user-controlled: users can see and delete it. Injected memories are labeled as context, not instructions (`core/memory/store.py`).
- Untrusted content (scraped pages, RSS text, uploads, memories) must not override system rules.

## Verify

- Add tests for the denied path (no approval means refused), traversal attempts, and a private-IP URL that must be rejected.
- Before committing, scan the staged diff for secrets. In PowerShell: `git diff --cached | Select-String -Pattern 'api_key|secret|token|sk-'`.
