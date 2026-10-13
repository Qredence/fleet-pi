# ADR 0002: Cloudflare–Neon deployment trust zones

## Status

Superseded — 2026-10-13. Originally accepted 2026-07-10 for Vercel. Cloudflare Workers is the only host.

## Context

Fleet Pi runs locally without authentication but mirrors Pi sessions to Neon on
Cloudflare Workers. Production and Preview must fail closed when secrets,
migrations, or trust-zone markers are wrong. Preview must not share production
identities or transcripts.

## Decision

- Define trust zones: `local`, `cloudflare-production`, `cloudflare-preview`.
- On Cloudflare Worker boot, run `assertDeploymentReadyOnBoot()` before serving auth.
- CI runs `verify-deployment-readiness` and `pnpm build:cloudflare` as the release gate.
- Preview requires:
  - `FLEET_PI_DEPLOYMENT_TRUST_ZONE=preview`
  - Distinct `FLEET_PI_PREVIEW_DATABASE_MARKER` from production
  - Explicit `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS`
- Production keeps explicit production origins only.

## Consequences

- Misconfigured Preview deployments fail at boot instead of accepting cross-zone
  OAuth state.
- Operators use `docs/runbooks/deployment-release-gate.md` for promotion.
- Local anonymous development remains unchanged.
