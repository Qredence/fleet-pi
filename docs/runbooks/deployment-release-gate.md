# Deployment release gate

Operator and CI workflow for promoting Fleet Pi on Cloudflare Workers with
Neon-backed auth and Pi session mirroring.

## What the gate checks

`pnpm verify-deployment-readiness` validates:

- Required hosted env vars for Neon Managed Auth and chat mirroring
- Preview trust-zone markers (`FLEET_PI_DEPLOYMENT_TRUST_ZONE=preview`)
- Distinct preview/production database markers on Preview
- Optional owner-connection probes when migration URLs are set:
  - `FLEET_PI_AUTH_MIGRATION_DATABASE_URL`
  - `FLEET_PI_CHAT_MIGRATION_DATABASE_URL`

The web app also calls `assertDeploymentReadyOnBoot()` during Better Auth
initialization on hosted Workers so missing secrets fail before serving auth routes.

## CI

The `cloudflare-release-gate` job in `.github/workflows/ci.yml` runs:

1. `pnpm --filter web build:cloudflare`
2. `pnpm verify-deployment-readiness` for production-shaped env (`FLEET_PI_DEPLOYMENT=cloudflare`)
3. `pnpm verify-deployment-readiness` for preview-shaped env (marker must appear in chat database URLs)
4. Optional owner-connection probes when GitHub Actions secrets are configured:
   - `FLEET_PI_AUTH_MIGRATION_DATABASE_URL`
   - `FLEET_PI_CHAT_MIGRATION_DATABASE_URL`

When migration secrets are absent, CI still enforces env + preview URL/marker checks.
Operators must run step 3 locally with owner URLs before production promotion.

## Pre-promotion checklist

1. Apply auth grants: `pnpm auth:migrate`
2. Apply chat mirror migrations: `pnpm chat:migrate`
3. Run readiness with owner URLs:
   ```bash
   FLEET_PI_AUTH_MIGRATION_DATABASE_URL=... \
   FLEET_PI_CHAT_MIGRATION_DATABASE_URL=... \
   FLEET_PI_DEPLOYMENT=cloudflare \
   pnpm verify-deployment-readiness
   ```
4. Deploy Worker: `pnpm --filter web deploy:cloudflare`

## Preview Workers (PR)

Label `cloudflare-preview` on a PR to deploy an isolated Worker Preview. CI
refuses upload when the Neon preview branch `fleet_pi_app` URL is missing or
matches production. See `.github/workflows/cloudflare.yml` and
`apps/web/scripts/cloudflare/assert-preview-worker-secrets.ts`.
