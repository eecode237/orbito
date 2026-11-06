# Security & Permissions

ORBITO can eventually touch CVs, email, websites, files and shell commands. The
security model is built into the architecture, not bolted on.

## Trust boundaries

```text
Browser  ──HTTPS──►  API  ──►  Gateway / Tools  ──►  Providers & web
   │                  │
   │                  └─ never exposes provider keys
   └─ no direct provider calls
```

- API keys live only in server-side settings.
- The model never receives credentials, raw database access, or arbitrary
  outbound request control.
- Tool inputs are validated inside the tool, not by the prompt.

## Permission matrix

| Action | Policy |
|---|---|
| Search public websites | Automatic |
| Read a public page / document | Automatic |
| Generate a CV, plan, summary | Automatic |
| Prepare a job application | Automatic |
| Submit an application | **Approval** |
| Send email / notification | **Approval** |
| Write or delete a file | **Approval** |
| Access an external account | **Explicit authorization** |
| Execute shell commands | **Restricted sandbox** |

Enforced today: tool-level permission declarations, approval-required lists in
agent prompts, deletion endpoints refusing unapproved execution. The durable
approval queue and audit records land with Phase 3 tasks.

## SSRF protection

Every user-supplied URL (`browser`, scraping) passes `tools/net.py`:

1. Scheme must be `http`/`https`; credentials and fragments rejected.
2. Optional tenant allowlist (`SCRAPING_ALLOWED_DOMAINS`) checked.
3. DNS is resolved; every answer must be a public IP (no loopback, private,
   link-local, multicast, reserved, unspecified).
4. Redirects are followed by httpx, so re-validation on redirect is a Phase 4
   hardening item.
5. Responses are capped by size; content type must be HTML/XML.

Scraping respects robots.txt/terms by policy. ORBITO does not implement login,
CAPTCHA, paywall or access-control bypass.

## Secrets

- `.env` is git-ignored; `.env.example` contains names only.
- Never log keys, tokens or prompts containing them.
- `APP_SECRET_KEY` must be replaced in any shared environment.
- Provider keys are per-deployment today; per-user encrypted provider keys
  (`model_providers.secret_ref`) arrive with auth.

## Uploads

- 25 MB cap, filename sanitised, stored under `.data/uploads` (swap for S3/R2).
- Content type is recorded but not trusted; server-side scanning (ClamAV) is on
  the Phase 7 checklist.
- Document extraction supports PDF/text; unsupported types fail closed.
- Files are never executed.

## Memory privacy

- Users can list, add and delete memories.
- Only explicit “remember …” statements and workspace context are stored.
- Conversation history is scoped to the conversation.
- No hidden profiling. Workspace scoping and export/delete-all land in Phase 3.

## Execution isolation

Generated code must run in a container with no host mounts, no network by
default, CPU/memory/time limits, and an explicit approval. Until that exists,
the Build agent only plans — it does not execute shell.

## Production checklist

- [ ] Auth + session management (Better Auth) and per-user ownership checks.
- [ ] PostgreSQL RLS policies for every user-owned table.
- [ ] Per-user and per-IP rate limits (Redis).
- [ ] Encrypted provider credentials with rotation.
- [ ] Audit log writes for every approval-gated action.
- [ ] Redirect re-validation and DNS-rebinding protection for fetches.
- [ ] Upload malware scanning and signed object-storage URLs.
- [ ] CSP, HSTS, secure cookies, CORS allowlist.
- [ ] OpenTelemetry traces + alerting on provider errors and cost spikes.
- [ ] Backups, restore drill, incident runbook.
