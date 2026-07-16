# Daytona Stateful Sandbox

This runbook describes Fleet Pi's Daytona sandbox integration: per-user isolated sandboxes with persistent workspace volumes, gated by Better Auth sessions.

## Architecture

Fleet Pi provisions per-user Daytona sandboxes for authenticated users. The server holds a single org-level `DAYTONA_API_KEY` and manages sandboxes on behalf of users.

```
Authenticated user → POST /api/chat (with session cookie)
  → Better Auth extracts userId
  → isDaytonaEnabled(userId) → true
  → getUserSandbox(userId) → provisions or resumes per-user sandbox
  → Pi tool operations (bash/read/write/edit) route to sandbox
  → agent-workspace volume persists across sandbox restarts
```

**Graceful degradation:** When `DAYTONA_API_KEY` is unset or user is unauthenticated, all operations fall back to host-local execution.

## Tenancy model

| Resource         | Naming Convention            | Lifecycle                                              |
| ---------------- | ---------------------------- | ------------------------------------------------------ |
| Sandbox          | `fleet-pi-user-{userId}`     | Stopped on runtime TTL expiry, resumed on next session |
| Workspace volume | `fleet-pi-ws-{userId}`       | Persists across sandbox restarts/deletions             |
| Session volume   | `fleet-pi-sessions-{userId}` | Optional, gated by `FLEET_PI_PERSIST_SESSIONS=true`    |
| Snapshot         | `fleet-pi-v{version}`        | Shared across users, speeds up sandbox creation        |

**Persistence contract:** User edits under `agent-workspace/` live on `fleet-pi-ws-{userId}` at `/home/daytona/fleet-pi/agent-workspace`. Sandbox stop/recreate reuses the same volume. Prepare flattens a nested `agent-workspace/` when present (nested wins over root stubs) and quarantines foreign monorepo pollution under `.fleet-pi-quarantine/` on the volume. Sparse seed runs only when `manifest.json` is missing, using non-clobber `cp -an` so existing files win. Do not delete the workspace volume unless intentionally resetting that user.

Labels on sandboxes: `{ managedBy: "fleet-pi", userId, email, createdAt }`

## Environment

```bash
# Required for Daytona features
DAYTONA_API_KEY=...          # Org-level API key from app.daytona.io/dashboard/keys
BETTER_AUTH_SECRET=...       # Required for user authentication

# Optional
DAYTONA_TARGET=us            # Region (us or eu)
DAYTONA_API_URL=...          # Defaults to Daytona Cloud
DAYTONA_WEBHOOK_SECRET=...   # Required before webhook events mutate local cache
FLEET_PI_PERSIST_SESSIONS=true  # Enable .fleet/ session volume persistence
AWS_REGION=us-east-1         # For Bedrock (LLM provider)
```

## Sandbox paths

| Purpose                         | Path                                     |
| ------------------------------- | ---------------------------------------- |
| Repo root                       | `/home/daytona/fleet-pi`                 |
| Workspace volume mount          | `/home/daytona/fleet-pi/agent-workspace` |
| Session volume mount (optional) | `/home/daytona/fleet-pi/.fleet`          |
| Web preview port                | `3000`                                   |

## How it works

### Tool execution routing (Phase 2)

When Daytona is enabled for a user, the Pi runtime creates custom tool definitions backed by sandbox operations:

- `BashOperations` → `sandbox.process.executeCommand()`
- `ReadOperations` → `sandbox.fs.downloadFile()`
- `WriteOperations` → `sandbox.fs.uploadFile()`
- `EditOperations` → download + apply diff + upload
- `GrepOperations`, `FindOperations`, `LsOperations` → sandbox shell commands

These replace the built-in host-local tools via the Pi SDK's `customTools` mechanism.

### Workspace bootstrap (Phase 3)

Bootstrap uses a `WorkspaceFS` abstraction that dispatches to either:

- `createLocalWorkspaceFS()` — wraps `node:fs/promises` (default)
- `createSandboxWorkspaceFS(sandbox)` — wraps Daytona SDK operations

The volume content persists across sandbox restarts. Prepare seeds only empty volumes (no `manifest.json` and no contract section directories) using non-clobber copy; bootstrap then fills missing stubs through the workspace API (`bootstrapAgentWorkspace()`) without overwriting user-authored files.

### Snapshot optimization (Phase 4)

Snapshots can pre-bake the Fleet Pi environment (Node 22, pnpm, system deps). When creating a new sandbox, the system tries the latest available `fleet-pi-v*` snapshot first. If none exists, new sandboxes fall back to the `node:22-bookworm` image. Shared across all users.

### Preview URLs (Phase 4)

`GET /api/sandbox/preview?port=3000` returns a Daytona preview URL for the authenticated user's sandbox. Requires an active sandbox.

### Session persistence (Phase 5)

When `FLEET_PI_PERSIST_SESSIONS=true`, a second volume (`fleet-pi-sessions-{userId}`) is mounted at `/home/daytona/fleet-pi/.fleet` to persist chat transcripts across sandbox restarts.

## Chat tool workflow

The `.pi/extensions/daytona-sandbox` extension still provides 15 explicit tools for direct sandbox management (Agent/Harness mode only). These are separate from the transparent tool routing above — they let the agent manage the authenticated user's sandbox, volumes, and snapshots explicitly.

Plan mode remains read-only and does not allow Daytona sandbox tools.

## Safety notes

- Per-user volumes guarantee workspace isolation between users
- Deleting a sandbox does NOT delete volumes
- Deleting a volume permanently removes all data
- FUSE volumes support one writer per path — one sandbox per user enforces this naturally
- Sandbox auto-stops after 30 minutes of inactivity (configurable)
- Tier 1/2 Daytona orgs have restricted network access (whitelist only)

## Resource limits

| Users  | Daytona Tier | Total vCPU | Total RAM | Total Disk |
| ------ | ------------ | ---------- | --------- | ---------- |
| 1-5    | Tier 1       | 10         | 10 GiB    | 30 GiB     |
| 5-50   | Tier 2       | 100        | 200 GiB   | 300 GiB    |
| 50-100 | Tier 3       | 250        | 500 GiB   | 2000 GiB   |

Each user (default): 1 vCPU + 1 GB RAM + 3 GB disk when running.

## Key files

| File                                             | Purpose                                             |
| ------------------------------------------------ | --------------------------------------------------- |
| `apps/web/src/lib/daytona/user-sandbox.ts`       | Per-user sandbox lifecycle manager                  |
| `apps/web/src/lib/daytona/sandbox-operations.ts` | Pi SDK operations backed by Daytona                 |
| `apps/web/src/lib/daytona/snapshot-config.ts`    | Snapshot management                                 |
| `apps/web/src/lib/daytona/client.ts`             | Low-level Daytona SDK wrapper                       |
| `apps/web/src/lib/workspace/workspace-fs.ts`     | WorkspaceFS abstraction (local/sandbox)             |
| `apps/web/src/lib/pi/server-runtime.ts`          | Runtime wiring (sandbox provisioning + customTools) |
| `apps/web/src/routes/api/sandbox/preview.ts`     | Auth-gated preview URL endpoint                     |
| `apps/web/src/routes/api/webhooks/daytona.ts`    | Webhook lifecycle event handler                     |
| `.pi/extensions/daytona-sandbox.ts`              | 15 explicit Daytona tools for agent                 |

Webhook lifecycle events are accepted for observability without a secret, but
cache-mutating side effects only run when `x-daytona-signature` matches
`DAYTONA_WEBHOOK_SECRET`.
