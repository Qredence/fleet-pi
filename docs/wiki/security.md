# Security

## Trust boundaries and tool scoping

Pi tools (read, write, edit, bash) execute on the server. File paths are validated against the active project/workspace root before execution. The workspace contract (`apps/web/src/lib/workspace/workspace-contract.ts`) rejects paths outside `agent-workspace/` for workspace APIs.

Bash commands in **Plan mode** are evaluated by `apps/web/src/lib/pi/command-policy.ts` before reaching Pi. Mutating commands, network tools, and shell metacharacters are blocked; only read-only inspection commands are permitted.

In **Agent mode** the full Pi bash tool is available, scoped to the active project root. **Harness mode** allows evaluation-oriented writes under workspace rules.

## Authentication

Fleet Pi supports two auth backends (`apps/web/src/lib/auth/auth-mode.ts`):

| Surface                      | Backend                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deployed (Vercel + Neon)** | **Neon Managed Auth** when `NEON_AUTH_BASE_URL` or `NEON_AUTH_URL` is set. Same-origin `/api/auth` proxy; JWKS-verified Bearer JWTs for Neon Function chat runtime. |
| **Local**                    | **Better Auth** with SQLite (`.fleet/auth.sqlite`) when no Neon Auth URL is set. Anonymous chat/workspace is allowed locally only.                                  |

`BETTER_AUTH_SECRET` remains required on Vercel for BYOK provider AES-GCM encryption even under Managed Auth. Cookie gate prefers `NEON_AUTH_COOKIE_SECRET`.

Session-scoped chat and workspace APIs require auth on Vercel, Neon Managed Auth, Neon Function surfaces, or when `FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH=1`.

## LLM credentials and org key scrubbing

On Vercel (`VERCEL=1`), org LLM env keys (`GEMINI_API_KEY`, `HF_TOKEN`, etc.) are scrubbed from the process so bash/tools cannot read them. Chat uses:

1. **Signed-in user BYOK** rows in encrypted `pi_user_providers`, and
2. **Platform Neon AI Gateway** (`NEON_AI_GATEWAY_TOKEN` + `NEON_AI_GATEWAY_BASE_URL`) as the default OpenAI-compatible backend for authenticated users without OCC BYOK.

Gateway credentials are not user-editable in Settings and are not exposed as BYOK provider rows.

## PII sanitization

`apps/web/src/lib/pii/sanitizer.ts` scrubs emails and phone numbers from user message content before logging or external forwarding.

## URL security

`.pi/extensions/lib/url-security.ts` blocks `fetch_content` requests to private network addresses. `fetch_content` is Agent/Harness only.

## Daytona sandbox isolation

On Vercel, **end-user sandboxes require BYOK** (`daytona` in `pi_user_providers`). Org `DAYTONA_API_KEY` must not back user sandboxes.

Each user gets volume `fleet-pi-ws-{userId}` mounted at `/home/daytona/agent-workspace`. Local/dev may use `DAYTONA_API_KEY` when no user BYOK is configured.

## Postgres isolation

`pi_*` mirror tables use RLS with `FORCE ROW LEVEL SECURITY`. Runtime must use non-owner `fleet_pi_app` connection string. Neon Data API stays **disabled** (`dataApi: false` in `neon.ts`).

## Circuit breaker

External LLM calls can be wrapped with Opossum (`apps/web/src/lib/pi/circuit-breaker.ts`) to fail fast when error rates spike.

## Dependency management

Dependabot, `syncpack`, and `overrides` in root `package.json` manage dependency hygiene. See `SECURITY.md` for vulnerability reporting.
