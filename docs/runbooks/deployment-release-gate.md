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
Operators must run the owner-connection probe locally before production promotion.
That probe includes the Data API privilege check (`authenticated` and `anonymous`
must not hold grants on `pi_*`). CI also fails when `neon.ts` sets `dataApi: true`
or the chat migrate runner imports `chat-postgres-data-api-auth`.

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

## Neon projection and recovery

Hosted transcripts live on the Durable Object. The Neon `pi_*` projection is
fail-open and is not the chat stream. The Neon Function pool stays at most 5
connections when it still serves legacy JSONL sessions. Schedule
`pnpm chat:maintain` weekly and alert when it fails. Declare a daily snapshot
for the `main` branch and record that recovery point before a production
promotion.

## Preview Workers (PR)

Label `cloudflare-preview` on a PR to deploy an isolated Worker Preview. CI
refuses upload when the Neon preview branch `fleet_pi_app` URL is missing or
matches production. See `.github/workflows/cloudflare.yml` and
`apps/web/scripts/cloudflare/assert-preview-worker-secrets.ts`.

- `.github/workflows/neon_workflow.yml` creates and deletes the Neon preview
  branch per PR. It needs the repo secrets `NEON_PROJECT_ID` and `NEON_API_KEY`.
- Previews deploy an allowlisted secret set. Feature-branch previews also need
  `BETTER_AUTH_SECRET` and `FLEET_PI_AUTH_DATABASE_URL` on that set, not only
  on production.
- Neon Managed Auth signup is open, so keep the deployment closed-beta until
  restricted signups exist.

## Related

- [Worker Postgres connection budget](./worker-postgres-connections.md)
