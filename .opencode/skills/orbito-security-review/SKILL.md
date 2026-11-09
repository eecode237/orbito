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
- [ ] Be honest about gaps. The durable approval queue and audit records are Phase 3 work. Don't describe them as shipped.

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

## Secrets and privacy

- `.env` is gitignored. `.env.example` lists names only.
- Never write keys to logs, prompts, API responses, or the frontend bundle. `NEXT_PUBLIC_*` values ship to the browser.
- Memory is user-controlled: users can see and delete it. Injected memories are labeled as context, not instructions (`core/memory/store.py`).
- Untrusted content (scraped pages, RSS text, uploads, memories) must not override system rules.

## Verify

- Add tests for the denied path (no approval means refused), traversal attempts, and a private-IP URL that must be rejected.
- Before committing, scan the staged diff for secrets. In PowerShell: `git diff --cached | Select-String -Pattern 'api_key|secret|token|sk-'`.
