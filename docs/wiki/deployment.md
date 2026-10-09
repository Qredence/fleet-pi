# Deployment

Fleet Pi deploys to **Vercel** (`fleet-pi-web`) for the web UI and catalog APIs, with optional **Neon Function** for long-running chat streaming when `VITE_FLEET_PI_CHAT_RUNTIME_URL` is set.

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

## Vercel environment variables

### Neon Managed Auth (recommended)

| Variable                                               | Required       | Notes                                                                |
| ------------------------------------------------------ | -------------- | -------------------------------------------------------------------- |
| `NEON_AUTH_BASE_URL` or `NEON_AUTH_URL`                | Yes            | Managed Auth base                                                    |
| `NEON_AUTH_COOKIE_SECRET`                              | Yes            | ≥32 chars; cookie gate                                               |
| `VITE_NEON_AUTH_URL`                                   | Yes            | Client proxy target                                                  |
| `NEON_AUTH_JWKS_URL`                                   | Yes            | JWT verification                                                     |
| `NEON_AUTH_ISSUER`                                     | Yes            | Fail-closed bearer JWTs                                              |
| `FLEET_PI_CHAT_DATABASE_URL`                           | Yes            | `fleet_pi_app` role; mirrors + settings                              |
| `BETTER_AUTH_SECRET`                                   | Yes            | BYOK AES-GCM encryption                                              |
| `NEON_AI_GATEWAY_TOKEN`                                | Yes*           | *When `preview.aiGateway` enabled                                    |
| `NEON_AI_GATEWAY_BASE_URL`                             | Yes*           | Bare branch gateway host                                             |
| `VITE_FLEET_PI_CHAT_RUNTIME_URL`                       | When streaming | Neon Function chat stream URL (set in Production)                    |
| `FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS`                   | When streaming | Browser origin allowlist; must match the Function's origin allowlist |
| `VITE_PUBLIC_POSTHOG_KEY` / `VITE_PUBLIC_POSTHOG_HOST` | Optional       | PostHog product analytics (browser)                                  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`            | Optional       | OAuth via Managed Auth                                               |

### Legacy Better Auth (local fallback only on Vercel if no Neon Auth URL)

`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FLEET_PI_AUTH_DATABASE_URL`, `FLEET_PI_CHAT_DATABASE_URL`

### Daytona

Users need BYOK `daytona` in `pi_user_providers`. Do **not** set org `DAYTONA_API_KEY` for end-user sandboxes on Vercel.

Optional: `DAYTONA_TARGET`, `DAYTONA_API_URL`, `DAYTONA_WEBHOOK_SECRET`, `FLEET_PI_REPOSITORY_URL`

## Cloudflare Workers (`apps/web/wrangler.jsonc`)

The web app (UI, Neon-managed auth proxy, chat API, session list) runs as the
Worker `fleet-pi-web` via the official `@cloudflare/vite-plugin` and
`nodejs_compat`. Vercel config is kept but no longer maintained.

- Build: `pnpm --filter web build:cloudflare` (sets `FLEET_PI_TARGET=cloudflare`,
  which enables the Cloudflare plugin in `vite.config.ts`). Local workerd
  preview: `pnpm --filter web preview:cloudflare` with secrets in
  `apps/web/.dev.vars` (gitignored).
- Deploy: `pnpm --filter web deploy:cloudflare` (or the `Cloudflare Workers`
  workflow) → `https://fleet-pi-web.<account-subdomain>.workers.dev`.
- Runtime mode: `FLEET_PI_DEPLOYMENT=cloudflare` (wrangler `vars`) makes
  `isVercelDeployment()` true, i.e. the same hosted, fail-closed,
  Postgres-backed paths as Vercel: sessions live in `/tmp` only for the
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
  same way they do on Vercel; tools run in Daytona.

## Build

```bash
NITRO_PRESET=vercel pnpm --filter web build:vercel
pnpm verify-deployment-readiness   # when migration URLs set
```

See [deployment release gate](../runbooks/deployment-release-gate.md) for production checklist.

## CI/CD

`.github/workflows/ci.yml` runs lint, typecheck, test, build, e2e, `validate-agents-md`, knip, jscpd, syncpack, and tech-debt scans on PRs and `main`.

`.github/workflows/neon_workflow.yml` manages one Neon preview branch per same-repo PR (Dependabot and fork PRs are skipped; they have no secrets):

- Project: repo variable `NEON_PROJECT_ID` (must be the non-production `soft-art-21843403` project) and secret `NEON_API_KEY`.
- Branch: `preview/pr-<number>` (PR number only: stable across head-branch renames, and no branch-name injection into the delete action), child of `main`, expires after 14 days, deleted when the PR closes.
- On open/reopen/push: `pnpm chat:migrate` (also reconciles `fleet_pi_app` grants) and `pnpm auth:migrate` on the direct owner URL, then a schema-diff comment against `main`. Connection outputs are masked.
- Vercel previews do **not** receive the branch URL yet. Wiring it needs either the Neon–Vercel integration on the preview environment, or a `VERCEL_TOKEN` secret plus a step that sets branch-scoped `FLEET_PI_CHAT_DATABASE_URL` (pooled `fleet_pi_app` URL — the action only returns owner URLs) and `FLEET_PI_AUTH_DATABASE_URL`, together with the preview trust-zone markers checked by `verify-deployment-readiness`.

## Devcontainer

`.devcontainer/devcontainer.json` — Node 22, pnpm, port 3000 forwarded, `pnpm install` on create.
