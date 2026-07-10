# ADR 0002: Vercel–Neon deployment trust zones

## Status

Accepted — 2026-07-10

## Context

Fleet Pi runs locally without authentication but mirrors Pi sessions to Neon on
Vercel. Production and Preview must fail closed when secrets, migrations, or
trust-zone markers are wrong. Preview must not share production identities or
transcripts.

## Decision

- Define trust zones: `local`, `vercel-production`, `vercel-preview`.
- On Vercel boot, run `assertDeploymentReadyOnBoot()` before serving Better Auth.
- CI runs `verify-deployment-readiness` plus `build:vercel` as a release gate.
- Preview requires:
  - `FLEET_PI_DEPLOYMENT_TRUST_ZONE=preview`
  - Distinct `FLEET_PI_PREVIEW_DATABASE_MARKER` from production
  - Explicit `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` (no broad
    `*.vercel.app` wildcard)
- Production keeps explicit production origins only.

## Consequences

- Misconfigured Preview deployments fail at boot instead of accepting cross-zone
  OAuth state.
- Operators use `docs/runbooks/deployment-release-gate.md` for promotion.
- Local anonymous development remains unchanged.
