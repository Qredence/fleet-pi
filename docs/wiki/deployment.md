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

## Build

```bash
NITRO_PRESET=vercel pnpm --filter web build:vercel
pnpm verify-deployment-readiness   # when migration URLs set
```

See [deployment release gate](../runbooks/deployment-release-gate.md) for production checklist.

## CI/CD

`.github/workflows/ci.yml` runs lint, typecheck, test, build, e2e, `validate-agents-md`, knip, jscpd, syncpack, and tech-debt scans on PRs and `main`.

`.github/workflows/neon_workflow.yml` creates/deletes Neon preview branches for PRs.

## Devcontainer

`.devcontainer/devcontainer.json` — Node 22, pnpm, port 3000 forwarded, `pnpm install` on create.
