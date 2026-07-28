---
kind: configuration_system
name: Environment and Deployment Configuration System
category: configuration_system
scope:
  - "**"
source_files:
  - .env.example
  - apps/web/vite.config.ts
  - apps/web/src/lib/env-manager.ts
  - apps/web/src/lib/deployment/index.ts
  - apps/web/src/lib/deployment/environment.ts
  - apps/web/src/lib/deployment/trust-zone.ts
  - apps/web/src/lib/deployment/readiness.ts
---

Fleet Pi uses a layered environment configuration system built around Vite, dotenv, and runtime validation. Configuration is loaded from `.env` and `.env.local` at the monorepo root, with client-facing variables prefixed `VITE_PUBLIC_` exposed through `import.meta.env` and server-side variables accessed via `process.env`. The system supports three trust zones — local, Vercel preview, and Vercel production — each with distinct required variables and security postures.

**Loading and layering**: `vite.config.ts` loads `.env` (non-overriding) then `.env.local` (overriding), sets `envDir` to the repo root so `VITE_PUBLIC_*` variables are resolved there, and ignores `.env*` changes during dev watch to avoid restarts when settings update env files at runtime. Server code can mutate `process.env` directly after writing to `.env.local` atomically via `updateEnvVars`, which writes a temp file and renames it for atomicity.

**Runtime validation**: The `apps/web/src/lib/deployment/` module provides `validateDeploymentReadiness()` which checks required environment variables per trust zone (legacy Better Auth vs Neon Managed Auth paths), validates database URL markers for preview isolation, verifies migration IDs are applied, and enforces RLS policies on `pi_sessions` tables. Boot-time checks call `assertDeploymentReadyOnBoot()` to fail fast on misconfiguration.

**Trust zone resolution**: `resolveDeploymentTrustZone()` determines the deployment context from `VERCEL` and `VERCEL_ENV`, driving behavior like whether JWT verification fails closed (`shouldFailClosedOnMirrorError`) and whether auth requires an authenticated mirror owner.

**Key variable categories**:

- AWS/Bedrock: `AWS_REGION`, `AWS_PROFILE`, `AWS_BEARER_TOKEN_BEDROCK`
- Authentication: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_ISSUER`, `NEON_AUTH_COOKIE_SECRET`
- Database: `FLEET_PI_AUTH_DATABASE_URL`, `FLEET_PI_CHAT_DATABASE_URL`, plus separate `_MIGRATION_DATABASE_URL` variants for migrations
- Chat runtime: `FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS`, `FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH`, `VITE_FLEET_PI_CHAT_RUNTIME_URL`
- Daytona: `DAYTONA_API_KEY`, `DAYTONA_API_URL`, `DAYTONA_TARGET`, `DAYTONA_WEBHOOK_SECRET`
- Analytics: `VITE_PUBLIC_POSTHOG_KEY`, `VITE_PUBLIC_POSTHOG_HOST`

**Runtime env mutation**: `apps/web/src/lib/env-manager.ts` exposes `updateEnvVar`, `updateEnvVars`, and `removeEnvVars` functions that safely edit `.env.local` and mirror changes into `process.env` without restarting the dev server. A `sanitizeProviderCredentialValue` helper strips accidental quotes from credential inputs.
