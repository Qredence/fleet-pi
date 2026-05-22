# Fleet Pi Runbooks

This page is operational reference material. New users should start with
[docs/README.md](README.md) and [Quick Start](quickstart.md).

Operational runbooks for incident response and troubleshooting the Fleet Pi
chat application.

---

## Incident Response

### IR-1: Bedrock API Outage (Circuit Breaker Open)

**Trigger:** Users report chat returning "Bedrock API is temporarily
unavailable" or all `/api/chat` requests fail with 500 errors.

1. **Verify the circuit breaker state**
   - Check application logs for `bedrock-api` circuit breaker events
   - Look for `open` state transitions in logs with `requestId` correlation
   - Run `curl -sf http://localhost:3000/api/health` to confirm the web server
     is still healthy
2. **Check Bedrock service status**
   - Verify AWS credentials are valid: `aws sts get-caller-identity`
   - Check Bedrock model access in the AWS Console for the configured region
     (default `us-east-1`)
   - Review AWS Service Health Dashboard for regional outages
3. **Inspect recent error patterns**
   - Search logs for the last 30 minutes: `grep "bedrock-api"` or `grep
"circuit breaker"`
   - Identify if errors are throttling (429), auth (403), or model-level (400)
   - Note the `errorThresholdPercentage` (50%) and `volumeThreshold` (5) — the
     breaker opens after 3 failures within 5 calls
4. **Wait for automatic recovery or force reset**
   - The circuit breaker `resetTimeout` is 30 seconds; it will attempt a
     half-open call after that period
   - If Bedrock is confirmed restored but the breaker is still open, restart
     the dev server to reset the breaker state
5. **Communicate**
   - Post in the incident channel: "Bedrock circuit breaker open — root cause
     under investigation"
   - If AWS is at fault, set status page to "degraded" and estimate recovery
     based on AWS status updates

### IR-2: Chat Session Corruption or Data Loss

**Trigger:** Users refresh the page and see an empty transcript, or the chat UI
shows "Session reset" repeatedly.

1. **Identify the affected session**
   - Extract `sessionId` from browser `localStorage` or from the `start` event
     in recent `/api/chat` request logs
   - Locate the Pi session file path under `.fleet/sessions/` inside the repo
     root
2. **Check session file validity**
   - Verify the session JSONL file exists and is readable
   - Ensure the file is inside the repo-scoped session directory (outside files
     are rejected by `isUsableSessionFile`)
   - Look for truncated or malformed JSONL lines at the end of the file
3. **Validate localStorage metadata**
   - If `localStorage` contains an invalid `sessionFile` (e.g. pointing to
     `/etc/hosts` or a non-existent path), the app silently starts a fresh
     repo-scoped session — this is expected behavior
   - Instruct the user to clear `localStorage` for the site if the stored
     metadata is corrupt
4. **Attempt manual hydration**
   - Call `POST /api/chat/session` with the `sessionId` to trigger
     `hydrateChatSession`
   - If the session file cannot be opened, the server returns an empty message
     list with `sessionReset: true`
5. **Recover or recreate**
   - If the file is corrupt beyond repair, archive it and let the user start a
     new session
   - If the issue is widespread, check disk space and file system permissions
     on `.fleet/sessions/`
6. **Follow up**
   - Document the root cause (disk full, permission issue, or Pi SDK bug)
   - Monitor `SessionManager.open` error rates for 24 hours

---

## Troubleshooting

### Bedrock Errors

Symptoms: Chat streams terminate with `error` events, model picker shows
unavailable models, or diagnostics contain model registry errors.

- **ThrottlingException (429)** — Bedrock is rate-limiting requests.
  - Check the `requestId` in logs to confirm it is the same across retries
  - The Pi SDK auto-retries with exponential backoff; do not manually retry
  - If sustained, enable request batching or switch to a lower-traffic model
    variant
- **AccessDeniedException (403)** — IAM role or profile lacks `bedrock:*`
  permissions.
  - Verify `AWS_PROFILE` and `AWS_BEARER_TOKEN_BEDROCK` environment variables
  - Ensure the IAM policy includes `bedrock:InvokeModel` and
    `bedrock:InvokeModelWithResponseStream`
- **ValidationException (400)** — The requested model ID is invalid.
  - Check `modelSelection` in the request body against the registry
  - Model IDs use region prefixes (e.g. `us.anthropic.claude-sonnet-4-6`); the
    backend normalizes candidates but a completely unknown ID will fail
- **ModelNotReadyException** — The model is not enabled in the AWS account.
  - Visit the Bedrock Console > Model access and enable the model for the
    current region
- **Network / timeout errors** — The circuit breaker `timeout` is 30 seconds.
  - If Bedrock does not respond within 30 seconds, the breaker counts it as a
    failure
  - Check VPC endpoints or corporate proxy settings if running in a restricted
    network

### Session Hydration Failures

Symptoms: After refreshing the browser, prior messages are gone; the UI shows a
blank chat; `sessionReset: true` appears in `/api/chat` responses.

- **Invalid `sessionFile` in localStorage** — The browser stores only Pi session
  metadata (`sessionFile` and `sessionId`). If `sessionFile` points outside the
  repo session directory, `isUsableSessionFile` returns `false` and a fresh
  repo-scoped session is created silently.
  - Remediation: Clear site `localStorage` and start a new chat
- **Missing or moved session file** — The session JSONL was deleted or moved
  after the metadata was stored.
  - Remediation: Check `.fleet/sessions/` for the file; if missing, the session
    is unrecoverable
- **Corrupt session JSONL** — A malformed line causes `SessionManager.open` to
  throw.
  - Remediation: Inspect the file with `head -n 20` and `tail -n 5`; remove
    trailing partial lines if safe, otherwise archive and start fresh
- **Race condition during streaming** — If a page refresh happens while the
  session is being compacted, the file may be in an inconsistent state.
  - Remediation: Wait 5 seconds and retry hydration; the compaction lock should
    release

### Circuit Breaker States

The Bedrock API call is wrapped by `opossum` with the following configuration:

| Option                     | Value     | Meaning                                 |
| -------------------------- | --------- | --------------------------------------- |
| `errorThresholdPercentage` | 50%       | Open after half of sampled calls fail   |
| `resetTimeout`             | 30,000 ms | Wait 30 s before trying half-open       |
| `volumeThreshold`          | 5         | Minimum 5 calls before breaker can open |
| `timeout`                  | 30,000 ms | Each call must complete within 30 s     |

- **Closed (normal)** — Requests flow to Bedrock. Failures are counted.
  - If you see intermittent errors but the breaker is still closed, Bedrock may
    be experiencing transient issues. Monitor error rates.
- **Open** — All calls are rejected immediately with the fallback error:
  `"Bedrock API is temporarily unavailable due to repeated failures. Please try
again later."`
  - Check logs for the `open` event on the `bedrock-api` breaker
  - Verify Bedrock health before assuming the breaker is stuck
  - The breaker will move to half-open automatically after `resetTimeout`
- **Half-Open** — The next call is allowed through as a probe.
  - If the probe succeeds, the breaker closes
  - If the probe fails, the breaker opens again for another `resetTimeout`
  - Do not manually flood the API with test requests during half-open; let the
    natural user traffic act as the probe

---

## Auth Database Role Separation

Production connects to the Neon auth database as `fleet_pi_app` (DML only).
Local standalone development can leave `FLEET_PI_AUTH_DATABASE_URL` unset and
use the SQLite fallback at `.fleet/auth.sqlite`. Schema migrations for Neon run
as `neondb_owner` (full DDL).

### Roles

| Role           | Privileges                                    | Used by             |
| -------------- | --------------------------------------------- | ------------------- |
| `neondb_owner` | Full DDL + DML (CREATE, ALTER, DROP, etc.)    | Migration CLI only  |
| `fleet_pi_app` | SELECT, INSERT, UPDATE, DELETE on auth tables | Running application |

### Running migrations

```bash
pnpm --filter web auth:migrate
```

Requires `FLEET_PI_AUTH_MIGRATION_DATABASE_URL` to be set (neondb_owner connection
string).

### Adding new Better Auth plugins that create tables

1. Run `pnpm --filter web auth:migrate` (creates the tables as neondb_owner)
2. Grant DML on new tables to fleet_pi_app:
   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."<new_table>" TO fleet_pi_app;
   ```
3. Verify the app can access the new table

### Rotating the fleet_pi_app password

1. Connect as neondb_owner and run:
   ```sql
   ALTER ROLE fleet_pi_app PASSWORD '<new-password>';
   ```
2. Update `FLEET_PI_AUTH_DATABASE_URL` in all deployment environments
3. Restart the application

### Current auth tables

- `public."user"` — User accounts
- `public."session"` — Active sessions
- `public."account"` — OAuth/credential accounts
- `public."verification"` — Email verification tokens

---

## Chat Session Mirror Database

Pi session JSONL files under `.fleet/sessions/` remain authoritative. When
`FLEET_PI_CHAT_DATABASE_URL` is set, Fleet Pi mirrors full session entries and
run provenance into Neon Postgres for search, analytics, cross-surface history,
and debugging.

### Roles

| Role           | Privileges                                      | Used by             |
| -------------- | ----------------------------------------------- | ------------------- |
| `neondb_owner` | Full DDL + DML (CREATE, ALTER, DROP, etc.)      | Migration CLI only  |
| `fleet_pi_app` | SELECT, INSERT, UPDATE, DELETE on `pi_*` tables | Running application |

### Running migrations

```bash
pnpm --filter web chat:migrate
```

Requires `FLEET_PI_CHAT_MIGRATION_DATABASE_URL` to be set to a direct
`neondb_owner` connection string. Runtime deployments should use
`FLEET_PI_CHAT_DATABASE_URL` with a pooled app-role connection string.

### Current chat mirror tables

- `public.pi_sessions` — Pi session headers and current session metadata
- `public.pi_session_entries` — Full raw Pi entries plus normalized search fields
- `public.pi_runs` — Assistant turn/run summaries
- `public.pi_run_events` — Ordered streamed chat events
- `public.pi_tool_executions` — Tool call inputs, outputs, and claimed paths
- `public.pi_file_mutations` — File mutation summaries attributed to runs/tools

---

## Quick Reference

| Command                                            | Purpose                                          |
| -------------------------------------------------- | ------------------------------------------------ |
| `curl -sf http://localhost:3000/api/health`        | Verify web server health                         |
| `aws sts get-caller-identity`                      | Verify AWS credentials                           |
| `pnpm --filter web test`                           | Run unit tests (including circuit breaker tests) |
| `pnpm lint`                                        | Check code quality                               |
| `pnpm knip`                                        | Detect unused code                               |
| `grep -r "bedrock-api" apps/web/src/lib/logger.ts` | Find log correlation                             |

## Related Files

- `apps/web/src/lib/pi/circuit-breaker.ts` — Breaker configuration and factory
- `apps/web/src/lib/pi/server.ts` — Bedrock invocation and session runtime
- `apps/web/src/lib/pii/sanitizer.ts` — Input redaction before logging
- `apps/web/src/lib/logger.ts` — Pino logger with redaction and `requestId`
  correlation
