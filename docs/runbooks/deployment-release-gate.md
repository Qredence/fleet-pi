# Deployment release gate

Operator and CI workflow for promoting Fleet Pi to Vercel with Neon-backed auth
and Pi session mirroring.

## What the gate checks

`pnpm verify-deployment-readiness` validates:

- Required Vercel env vars for Better Auth and chat mirroring
- Preview trust-zone markers (`FLEET_PI_DEPLOYMENT_TRUST_ZONE=preview`)
- Distinct preview/production database markers on Preview
- Optional owner-connection probes when migration URLs are set:
  - `FLEET_PI_AUTH_MIGRATION_DATABASE_URL`
  - `FLEET_PI_CHAT_MIGRATION_DATABASE_URL`

The web app also calls `assertDeploymentReadyOnBoot()` during Better Auth
initialization on Vercel so missing secrets fail before serving auth routes.

## CI

The `vercel-release-gate` job in `.github/workflows/ci.yml` runs:

1. `NITRO_PRESET=vercel pnpm --filter web build:vercel`
2. `pnpm verify-deployment-readiness` for production-shaped env
3. `pnpm verify-deployment-readiness` for preview-shaped env (marker must appear in chat/auth database URLs)
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
   pnpm verify-deployment-readiness
   ```
4. Deploy to Preview with isolated Neon branch and preview-only secrets
5. Run authenticated smoke against Preview (sign in, create session, resume)
6. Promote to Production only after gate + smoke pass

## Break-glass

If production is blocked by a false-positive readiness check:

1. Capture `pnpm verify-deployment-readiness` output
2. Confirm Neon migration ledger and RLS state manually
3. Temporarily set missing env vars in Vercel (never disable owner-only mirror rules)
4. Redeploy and re-run smoke

Do **not** disable `assertDeploymentReadyOnBoot()` or owner-only persistence to
unblock traffic.

## Legacy ownerless mirror data

After owner-only enforcement is live:

```bash
# Inspect only
pnpm quarantine-orphan-sessions -- --dry-run

# Quarantine ownerless rows (no production delete)
pnpm quarantine-orphan-sessions

# Purge after explicit approval and migration window
pnpm quarantine-orphan-sessions -- --purge
```

Requires `FLEET_PI_CHAT_MIGRATION_DATABASE_URL` (owner connection).
