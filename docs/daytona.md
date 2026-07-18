# Daytona Stateful Sandbox

This runbook describes Fleet Pi's Daytona sandbox integration: per-user isolated sandboxes with a durable agent-workspace volume, gated by Better Auth and **BYOK Daytona API keys**.

## Architecture

Fleet Pi provisions one Daytona sandbox per authenticated user, using **that user's** Daytona API key (Settings → Providers → Daytona / `pi_user_providers`). The agent runs on the host; tools run in the sandbox via the Fleet adapter extension (`.pi/extensions/daytona-sandbox`), aligned with `@daytona/pi` ops patterns.

```
Authenticated user → POST /api/chat (with session cookie)
  → Better Auth extracts userId
  → resolveDaytonaRuntimeApiKey(userId) → user BYOK key (Vercel) or env fallback (local)
  → isDaytonaEnabled(userId, key) → true
  → getUserSandbox(userId) → provisions or resumes per-user sandbox
  → Fleet adapter registers sandbox-backed bash/read/write/edit/ls/find/grep
  → agent-workspace volume persists across sandbox restarts
```

**Graceful degradation:** When no Daytona key is resolved, tools fall back to host-local execution. On Vercel, missing user Daytona BYOK does not fall back to org `DAYTONA_API_KEY`.

**CLI:** Stock `npm:@daytona/pi` belongs in personal/global Pi packages (`~/.pi`) for local `pi --daytona` — not in this project's `.pi/settings.json`, which would collide with the Fleet adapter. The web resource loader also excludes that package so it does not collide with the Fleet adapter.

## Tenancy model

| Resource         | Naming Convention        | Lifecycle                                              |
| ---------------- | ------------------------ | ------------------------------------------------------ |
| Sandbox          | `fleet-pi-user-{userId}` | Stopped on runtime TTL expiry, resumed on next session |
| Workspace volume | `fleet-pi-ws-{userId}`   | Persists across sandbox restarts/deletions             |
| Snapshot         | `fleet-pi-v{version}`    | Shared when available; speeds up sandbox creation      |

**Persistence contract:** User edits under `agent-workspace/` live on `fleet-pi-ws-{userId}` mounted at `/home/daytona/agent-workspace`. There is **no** full-repo clone and **no** sandbox `.fleet` session volume — Pi sessions stay on the host / Neon mirror. Sparse seed runs only when `manifest.json` is missing, using non-clobber `cp -an`. Do not delete the workspace volume unless intentionally resetting that user.

**Migration:** Sandboxes that still mount the legacy `/home/daytona/fleet-pi` (or `/home/daytona/fleet-pi/agent-workspace`) path are **recreated automatically** on next warm-up — the durable `fleet-pi-ws-*` volume is kept and remounted at `/home/daytona/agent-workspace`. Ephemeral leftover `/home/daytona/fleet-pi` trees (not mounts) are deleted during prepare. Do not auto-delete volumes.

Labels on sandboxes: `{ managedBy: "fleet-pi", userId, email, createdAt }`

## Environment

```bash
# Local/dev fallback only (ignored as sole key source on Vercel)
DAYTONA_API_KEY=...          # Optional local fallback
BETTER_AUTH_SECRET=...       # Required for user authentication

# Optional
DAYTONA_TARGET=us            # Region (us or eu)
DAYTONA_API_URL=...          # Defaults to Daytona Cloud
DAYTONA_WEBHOOK_SECRET=...   # Required before webhook events mutate local cache
FLEET_PI_REPOSITORY_URL=...  # HTTPS repo used to sparse-seed agent-workspace
AWS_REGION=us-east-1         # For Bedrock (LLM provider)
```

On Vercel, each logged-in user must store their Daytona API key as the `daytona` provider secret.

## Sandbox paths

| Purpose                | Path                                |
| ---------------------- | ----------------------------------- |
| Workspace volume mount | `/home/daytona/agent-workspace`     |
| Pi auth (non-Secrets)  | `/home/daytona/.pi/agent/auth.json` |
| Web preview port       | `3000`                              |

## Provider credentials (Daytona Secrets)

LLM API keys that have known HTTPS API hosts are synced into the **user's** Daytona organization as Secrets (`fleet_pi_<providerId>`) and mounted on sandbox create via the `secrets` map. The sandbox only sees opaque placeholders (`dtn_secret_*`); Daytona substitutes the real value on egress to the allowlisted hosts.

| Provider                                 | Hosts (examples)                    |
| ---------------------------------------- | ----------------------------------- |
| Google Gemini                            | `generativelanguage.googleapis.com` |
| OpenAI                                   | `api.openai.com`                    |
| Anthropic                                | `api.anthropic.com`                 |
| Mistral / Groq / OpenRouter / AI Gateway | their public API hosts              |
| OpenAI Chat Completions                  | hostname from HTTPS base URL        |

**Still injected as plaintext** (cannot use Secrets egress): OAuth (GitHub Copilot), Google Vertex ADC, Bedrock signing keys, Ollama base URL, OCC base URL / model ID.

When Secrets-backed credentials change while a sandbox is cached, Fleet **recreates** the sandbox (same volume) so placeholders remount. Plaintext `auth.json` sync alone cannot update create-time Secrets.

If the Daytona Secrets API is unavailable for the user's org (for example `Access denied` on list/create), Fleet falls back to the pre-Phase-2 behavior: inject eligible API keys as plaintext in sandbox `auth.json` / env instead of failing sandbox provision. If sync fails partway through upserts, Fleet keeps the partial `secrets` map for providers that succeeded and recreates sandboxes that still have stale Secret placeholders when falling back to plaintext.

## How it works

### Tool execution (Fleet adapter)

When Daytona is enabled, `.pi/extensions/daytona-sandbox` registers sandbox-backed tools using `createSandboxOperations` from `apps/web`:

- `bash`, `read`, `write`, `edit`, `ls`, `find`, `grep` → Daytona sandbox FS/process
- `daytona_get_status` — read-only status of the user's managed sandbox
- `preview_url` — preview link for a port in the sandbox

These replace host-local builtins when a sandbox is attached on `session_start`. Plan mode does not allow Daytona status/preview tools.

### Workspace bootstrap

Bootstrap uses a `WorkspaceFS` abstraction that dispatches to either:

- `createLocalWorkspaceFS()` — wraps `node:fs/promises` (default)
- `createSandboxWorkspaceFS(sandbox)` — wraps Daytona SDK operations

The volume content persists across sandbox restarts. Prepare seeds only empty volumes (no `manifest.json`) using non-clobber copy; bootstrap then fills missing stubs without overwriting user-authored files.

### Snapshot optimization

Snapshots can pre-bake the Fleet Pi environment (Node 22, pnpm, system deps). When creating a new sandbox, the system tries the latest available `fleet-pi-v*` snapshot first. If none exists, new sandboxes fall back to the `node:22-bookworm` image.

### Preview URLs

`GET /api/sandbox/preview?port=3000` returns a Daytona preview URL for the authenticated user's sandbox. Requires an active sandbox.

## Safety notes

- Per-user volumes (under each user's Daytona account / BYOK key) isolate workspaces
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

| File                                               | Purpose                                           |
| -------------------------------------------------- | ------------------------------------------------- |
| `apps/web/src/lib/daytona/user-sandbox.ts`         | Per-user sandbox + volume provisioning            |
| `apps/web/src/lib/daytona/sandbox-prepare.ts`      | Sparse seed + volume migration                    |
| `apps/web/src/lib/daytona/sandbox-operations.ts`   | Tool ops for bash/read/write/edit/grep/find/ls    |
| `apps/web/src/lib/daytona/secret-hosts.ts`         | HTTPS allowlists for Secrets-eligible providers   |
| `apps/web/src/lib/daytona/sync-daytona-secrets.ts` | Upsert org Secrets + createSandbox secrets map    |
| `.pi/extensions/daytona-sandbox.ts`                | Fleet adapter: tool registration + status/preview |
| `apps/web/src/lib/pi/exclude-stock-daytona-pi.ts`  | Exclude `npm:@daytona/pi` from web loader         |
| `apps/web/src/lib/pi/server-runtime.ts`            | Eager warm-up; no customTools                     |
