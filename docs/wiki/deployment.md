# Deployment

Cloudflare Workers is the primary host. The `fleet-pi-web` Worker serves the web UI, Settings, and catalog APIs. New hosted Agent turns stream from the signed-in user's Durable Object (`UserPiDurable`). That object's SQLite storage is the transcript. The Daytona volume holds the harness and artifacts. Neon keeps Managed Auth, `pi_user_settings`, and an optional session projection. There is no Neon Object Storage bucket and no R2 binding.

The Neon Function remains an interim path for legacy JSONL sessions when `VITE_FLEET_PI_CHAT_RUNTIME_URL` is set. Vercel is not a deployment target; `docs/adr/0002-vercel-neon-deployment-trust-zones.md` records that earlier host.

## Neon provisioning (`neon.ts`)

From repo root:

```bash
neon link
neon checkout main   # or your branch
pnpm neon:deploy     # provisions Managed Auth, AI Gateway, chat Function
pnpm auth:migrate
pnpm chat:migrate
pnpm neon:env-pull   # writes NEON_* vars to .env.local
```

`neon.ts` enables:

- `auth: true` — Neon Managed Auth
- `preview.aiGateway: true` — branch-scoped AI Gateway (`NEON_AI_GATEWAY_*`)
- `preview.functions.chat` — chat runtime Neon Function
- `dataApi: false` — Data API stays off

AI Gateway requires a paid Neon plan and `aws-us-east-2`.

`neon.ts` declares a private proof bucket `fleet-pi-spike` under
`preview.buckets` only (not for transcripts or Daytona workspace). When that
bucket is deployed, `neon env pull` injects branch `AWS_*` S3 vars — keep them
for the spike script; do not treat them as Bedrock credentials. The `.neon`
branch pin is gitignored.

## Hosted environment variables (Cloudflare Workers)

### Neon Managed Auth (recommended)

| Variable                                               | Required       | Notes                                                                       |
| ------------------------------------------------------ | -------------- | --------------------------------------------------------------------------- |
| `NEON_AUTH_BASE_URL` or `NEON_AUTH_URL`                | Yes            | Managed Auth base                                                           |
| `NEON_AUTH_COOKIE_SECRET`                              | Yes            | ≥32 chars; cookie gate                                                      |
| `VITE_NEON_AUTH_URL`                                   | Yes            | Client proxy target                                                         |
| `NEON_AUTH_JWKS_URL`                                   | Yes            | JWT verification                                                            |
| `NEON_AUTH_ISSUER`                                     | Yes            | Fail-closed bearer JWTs                                                     |
| `FLEET_PI_CHAT_DATABASE_URL`                           | Yes            | `fleet_pi_app` role; mirrors + settings                                     |
| `BETTER_AUTH_SECRET`                                   | Yes            | BYOK AES-GCM encryption                                                     |
| `NEON_AI_GATEWAY_TOKEN`                                | Yes*           | *When `preview.aiGateway` enabled                                           |
| `NEON_AI_GATEWAY_BASE_URL`                             | Yes*           | Bare branch gateway host                                                    |
| `VITE_FLEET_PI_CHAT_RUNTIME_URL`                       | When streaming | Neon Function chat stream URL (set in Production)                           |
| `FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS`                   | When streaming | Browser origin allowlist; must match the Function's origin allowlist        |
| `VITE_PUBLIC_POSTHOG_KEY` / `VITE_PUBLIC_POSTHOG_HOST` | Optional       | PostHog product analytics (browser)                                         |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`            | Optional       | OAuth via Managed Auth; register callbacks on the active workers.dev origin |

### Legacy Better Auth (when no Neon Auth URL is set)

`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FLEET_PI_AUTH_DATABASE_URL`, `FLEET_PI_CHAT_DATABASE_URL`

### Daytona

Users need BYOK `daytona` in `pi_user_providers`. Do **not** set org `DAYTONA_API_KEY` for end-user sandboxes on Cloudflare.

Optional: `DAYTONA_TARGET`, `DAYTONA_API_URL`, `DAYTONA_WEBHOOK_SECRET`, `FLEET_PI_REPOSITORY_URL`

## Cloudflare Workers (`apps/web/wrangler.jsonc`)

The web app (UI, Neon-managed auth proxy, chat API, session list) runs as the
Worker `fleet-pi-web` via the official `@cloudflare/vite-plugin` and
`nodejs_compat`.

- Build: `pnpm --filter web build:cloudflare` (sets `FLEET_PI_TARGET=cloudflare`,
  which enables the Cloudflare plugin in `vite.config.ts`). Local workerd
  preview: `pnpm --filter web preview:cloudflare` with secrets in
  `apps/web/.dev.vars` (gitignored).
- Deploy: `pnpm --filter web deploy:cloudflare` (or the `Cloudflare Workers`
  workflow on `main`) → `https://fleet-pi-web.<account-subdomain>.workers.dev`.
- PR previews: label `cloudflare-preview` runs `wrangler preview` (not
  `versions upload`) with secrets scoped to the Neon branch
  `preview/pr-<number>` on `vars.NEON_PROJECT_ID` (soft-art). CI refuses
  upload when the preview `fleet_pi_app` URL is missing or matches
  `FLEET_PI_PRODUCTION_CHAT_DATABASE_URL`; only an allowlisted secret set is
  applied (no production `DAYTONA_*` or org `OPENAI_*`; preview Neon AI Gateway
  uses branch-scoped `PREVIEW_NEON_AI_GATEWAY_*` GitHub secrets mapped to
  `NEON_AI_GATEWAY_*` on the Worker). Required repo secrets for labeled PR
  previews include `FLEET_PI_PRODUCTION_CHAT_DATABASE_URL`,
  `FLEET_PI_PRODUCTION_NEON_AUTH_BASE_URL`, `NEON_API_KEY`, `vars.NEON_PROJECT_ID`,
  `PREVIEW_VITE_NEON_AUTH_URL`, `PREVIEW_NEON_AUTH_*`, `PREVIEW_BETTER_AUTH_SECRET`,
  and `PREVIEW_NEON_AI_GATEWAY_TOKEN` / `PREVIEW_NEON_AI_GATEWAY_BASE_URL`.
- Runtime mode: `FLEET_PI_DEPLOYMENT=cloudflare` (wrangler `vars`) makes
  `isHostedDeployment()` true: sessions live in `/tmp` only for the
  request and Neon (`pi_sessions` read-back) is the source of truth.
- Entry: `src/server.ts` wraps TanStack Start's handler in a per-request
  scope (`lib/runtime/request-scope.ts`). Workers forbid reusing I/O objects
  across requests, so Neon `Pool`s (chat mirror and legacy Better Auth) are
  created per request there; transaction-scoped RLS (`set_config(
'app.current_user_id', $1, true)` inside `BEGIN … COMMIT`) works unchanged
  over `@neondatabase/serverless` WebSockets. Hyperdrive is not needed.
- Global scope: Workers reject timers/random values at module load.
  `scripts/cloudflare/worker-global-scope-shims.ts` patches the one dependency
  that does this in SSR (`@neondatabase/auth` tab id); our own module-level
  timers (session circuit breaker, reindex limiter) are lazy.
- Secrets: `wrangler secret put` / `wrangler secret bulk` from the env on
  the SSD — at least `FLEET_PI_CHAT_DATABASE_URL` (pooled, `fleet_pi_app`),
  `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_ISSUER`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the workers.dev origin),
  `BETTER_AUTH_TRUSTED_ORIGINS`, provider keys and Daytona keys.
  `VITE_NEON_AUTH_URL` is a build-time (client) variable: repo variable for CI.
- Neon Auth: add the workers.dev origin to the project's Neon Auth trusted
  domains, otherwise sign-in from the Worker is rejected.
- Limits: the gzip bundle is ~6.6 MB, so the account needs the Workers Paid
  plan (10 MB limit). Features that need a real filesystem or processes
  (local workspace projection/provenance, npm package installs) degrade the
  same way they do on Cloudflare; tools run in Daytona.
- Hosted split: the Worker serves the UI, Settings, and catalog. A new
  `/api/chat` turn on Cloudflare addresses `USER_PI_DURABLE` by the signed-in
  user id. The object keeps the transcript and any in-flight task. Legacy
  JSONL sessions may still stream from the Neon Function while
  `VITE_FLEET_PI_CHAT_RUNTIME_URL` is set. `POST /api/chat/durable-spike`
  is the scripted harness route. It is served only when the Worker sets
  `FLEET_PI_DURABLE_SPIKE=1`; leave it unset in production because the route
  reopens the user's harness. `DELETE /api/chat/account` also erases the
  user's Durable Object storage. Readiness does not require object-storage
  environment variables.

## Build

```bash
pnpm --filter web build:cloudflare
pnpm verify-deployment-readiness   # when migration URLs set
```

See [deployment release gate](../runbooks/deployment-release-gate.md) for production checklist.

## CI/CD

`.github/workflows/ci.yml` runs lint, typecheck, test, build, e2e, `validate-agents-md`, knip, jscpd, syncpack, and tech-debt scans on PRs and `main`.

`.github/workflows/neon_workflow.yml` manages one Neon preview branch per same-repo PR (Dependabot and fork PRs are skipped; they have no secrets):

- Project: repo variable `NEON_PROJECT_ID` (must be the non-production `soft-art-21843403` project) and secret `NEON_API_KEY`.
- Branch: `preview/pr-<number>` (PR number only: stable across head-branch renames, and no branch-name injection into the delete action), child of `main`, expires after 14 days, deleted when the PR closes.
- On open/reopen/push: `pnpm chat:migrate` (also reconciles `fleet_pi_app` grants) and `pnpm auth:migrate` on the direct owner URL, then a schema-diff comment against `main`. Connection outputs are masked.
- Cloudflare PR previews (label `cloudflare-preview`) receive the pooled
  `fleet_pi_app` URL for that branch via `assert-preview-worker-secrets.ts`
  and `NEON_API_KEY` / `vars.NEON_PROJECT_ID`.

## Devcontainer

`.devcontainer/devcontainer.json` — Node 22, pnpm, port 3000 forwarded, `pnpm install` on create.
