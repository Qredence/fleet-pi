# Secure Vercel–Neon deployment audit

Date: 2026-07-10

## Scope

Production (`fleet-pi-web.vercel.app`) and Preview trust zones with Neon project
`fleet-pi-auth`.

## Controls implemented

| Control                                 | Evidence                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------ |
| Boot-time env gate on Vercel            | `assertDeploymentReadyOnBoot()` in `apps/web/src/lib/auth/server.ts`     |
| CI release gate                         | `.github/workflows/ci.yml` → `vercel-release-gate`                       |
| Owner-only mirror writes                | `assertMirrorOwnerForPersistence` in `pi-session-ownership-db.ts`        |
| Per-user ephemeral JSONL dirs on Vercel | `getSessionDir(..., { userId })` in `server-shared.ts`                   |
| Preview DB URL cross-check              | `validateDeploymentReadiness` preview URL marker checks                  |
| Orphan upsert hardening                 | `PI_SESSION_USER_ID_ON_CONFLICT_SQL` preserves ownerless rows            |
| Session ownership on chat routes        | `enforceChatSessionOwnership` on session/resume/chat/abort/question/runs |
| Run ownership                           | `enforceRunOwnership` + `verifyRunOwnership`                             |
| Preview provenance isolation            | Path provenance filtered by `fetchUserSessionIds` on Vercel              |
| Cold-start recovery                     | `recoverOwnedSessionFile` in hydrate/create session paths                |
| User deletion                           | `DELETE /api/chat/session`, `DELETE /api/chat/account`                   |
| Legacy orphan quarantine                | `pnpm quarantine-orphan-sessions` runbook                                |
| Preview auth origins                    | No `*.vercel.app` wildcard in `VERCEL_AUTH_HOSTS`                        |
| Explicit auth allowed hosts             | `auth-host-policy.ts` lists production hosts only                        |

## Accepted risks

- Ephemeral workspace provenance SQLite on serverless instances is not a durable
  cross-request store; Postgres mirror is authoritative on Vercel.
- Post-deploy authenticated smoke remains an operator step when CI secrets do not
  include live Neon owner URLs.
- `lottie-web` direct `eval` build warning tracked as dependency risk.

## Verification

- `pnpm --filter web test`
- `pnpm typecheck`
- `pnpm verify-deployment-readiness` (production + preview env fixtures in CI)
- Manual: sign in on Preview, create session, refresh, resume, delete session
