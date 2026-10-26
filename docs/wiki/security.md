# Security

## Trust boundaries and tool scoping

Pi tools (read, write, edit, bash) execute on the server. File paths are validated against the active project/workspace root before execution. The workspace contract (`apps/web/src/lib/workspace/workspace-contract.ts`) rejects paths outside `agent-workspace/` for workspace APIs.

Bash commands in **Plan mode** are evaluated by `apps/web/src/lib/pi/command-policy.ts` before reaching Pi. Mutating commands, network tools, and shell metacharacters are blocked; only read-only inspection commands are permitted.

In **Agent mode** the full Pi bash tool is available, scoped to the active project root. **Harness mode** allows evaluation-oriented writes under workspace rules.

## Authentication

Fleet Pi supports two auth backends (`apps/web/src/lib/auth/auth-mode.ts`):

| Surface                          | Backend                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deployed (Cloudflare + Neon)** | **Neon Managed Auth** when `NEON_AUTH_BASE_URL` or `NEON_AUTH_URL` is set. Same-origin `/api/auth` proxy; JWKS-verified Bearer JWTs for chat APIs. |
| **Local**                        | **Better Auth** with SQLite (`.fleet/auth.sqlite`) when no Neon Auth URL is set. Anonymous chat/workspace is allowed locally only.                 |

`BETTER_AUTH_SECRET` remains required on Cloudflare for BYOK provider AES-GCM encryption even under Managed Auth. Cookie gate prefers `NEON_AUTH_COOKIE_SECRET`.

Session-scoped chat and workspace APIs require auth on Cloudflare, Neon Managed Auth, or when `FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH=1`. The route list is in [API endpoints](api/endpoints.md#authentication).

- `auth-mode.ts` stays client-safe. Server-side checks (`isChatAuthRequired`, `node:async_hooks`) live in `chat-api-auth.ts`.
- Neon Auth clients call same-origin `/api/auth` when `VITE_NEON_AUTH_URL` is set, so cookies stay first-party. Mint JWTs with `authClient.token()` and `credentials: "include"` (cached, single-flight), not Better Auth `getJWTToken()`.
- Mirror ownership fails closed (`shouldFailClosedOnMirrorError`, `requiresAuthenticatedMirrorOwner` in `deployment/trust-zone.ts`) on Cloudflare, Neon Managed Auth, or with `FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH`.
- Neon Managed Auth signup is closed-beta only until restricted signups exist.

## LLM credentials and org key scrubbing

On Cloudflare (`FLEET_PI_DEPLOYMENT=cloudflare`), org LLM env keys (`GEMINI_API_KEY`, `HF_TOKEN`, etc.) are scrubbed from the process so bash/tools cannot read them. Chat uses:

1. **Signed-in user BYOK** rows in encrypted `pi_user_providers`, and
2. **Platform Neon AI Gateway** (`NEON_AI_GATEWAY_TOKEN` + `NEON_AI_GATEWAY_BASE_URL`) as the default OpenAI-compatible backend for authenticated users without OCC BYOK.

Gateway credentials are not user-editable in Settings and are not exposed as BYOK provider rows.

## PII sanitization

`apps/web/src/lib/pii/sanitizer.ts` scrubs emails and phone numbers from user message content before logging or external forwarding.

## URL security

`.pi/extensions/lib/url-security.ts` blocks `fetch_content` requests to private network addresses. `fetch_content` is Agent/Harness only.

## Daytona sandbox isolation

On Cloudflare, **end-user sandboxes require BYOK** (`daytona` in `pi_user_providers`). Org `DAYTONA_API_KEY` must not back user sandboxes.

Each user gets volume `fleet-pi-ws-{userId}` mounted at `/home/daytona/agent-workspace`. Local/dev may use `DAYTONA_API_KEY` when no user BYOK is configured.

## Postgres isolation

`pi_*` mirror tables use RLS with `FORCE ROW LEVEL SECURITY`. Runtime must use non-owner `fleet_pi_app` connection string. Neon Data API stays **disabled** (`dataApi: false` in `neon.ts`).

- **Scoping.** Policies read `app.current_user_id`. Live databases may also expose `fleet_pi_current_user_id()`, which tries `auth.user_id()` and then the GUC. `FORCE` stops owner connection strings from bypassing isolation silently.
- **Identity tables.** Identity lives in `neon_auth` (Managed Auth). Better Auth tables (`user`, `session`, `account`, `verification`) and `neon_auth.*` must not use RLS. `pnpm auth:migrate` chains `auth-post-migrate.ts` to disable RLS and grant `fleet_pi_app` DML, and it drops legacy `public` Better Auth tables once `neon_auth` exists. Keep `neon_auth` private and never create views that expose `neon_auth.user`.
- **Data API grants.** Chat migrations revoke `authenticated`/`anonymous` grants on `pi_*` and EXECUTE on the SECURITY DEFINER ownership probes (`fleet_pi_check_session_owner`, `fleet_pi_lookup_session_id_by_file`). Only `fleet_pi_app` may call them. The probes bypass RLS on purpose so foreign-owned rows cannot hide. Do not re-apply `chat-postgres-data-api-auth` grant migrations. If orphan grants reappear, `20260723_revoke_data_api_pi_grants_again` re-asserts the revoke. `pnpm verify-deployment-readiness` fails while those roles still hold privileges on `pi_sessions`, `pi_user_providers`, or `pi_user_settings`.
- **Posture.** Prefer the Managed Auth cutover (`neon_auth` identity plus `pi_*` tenancy RLS) over hardening leftover public Better Auth tables. Fleet Pi follows Neon's server/Function pattern: cookies, JWKS Bearer JWT, and per-user scoping on `fleet_pi_app`. Do not enable the Data API to "complete" Managed Auth.
- **Cutover repair.** Users re-authenticate on Managed Auth. Remap ownership on a best-effort basis by email with `pnpm remap-auth-user-ids -- --file=remap.csv` (`email,oldUserId,newUserId`, or legacy `email,newUserId` while `public."user"` exists; `--dry-run` first). Quarantine ownerless rows with `pnpm quarantine-orphan-sessions`.

## Circuit breaker

External LLM calls can be wrapped with Opossum (`apps/web/src/lib/pi/circuit-breaker.ts`) to fail fast when error rates spike.

## Dependency management

Dependabot, `syncpack`, and `overrides` in root [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) manage dependency hygiene. See [`SECURITY.md`](../../SECURITY.md) for vulnerability reporting.

**Accepted advisory (DEP-010):** [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (`braces` ≤3.0.3, stack-exhaustion DoS via nested brace patterns). No patched release is published yet (latest is 3.0.3). It arrives through `micromatch` / `fast-glob` used by `@daytona/sdk`, `shadcn` registry tooling, and `jscpd` (dev). Glob patterns on those paths come from code, not end-user input. Add a `braces` floor once `>=3.0.4` ships.
