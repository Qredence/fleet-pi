#!/usr/bin/env bash
set -euo pipefail

# Both steps load .env/.env.local (repo root and apps/web) and require
# FLEET_PI_AUTH_MIGRATION_DATABASE_URL (neondb_owner connection string).
# Better Auth schema: programmatic `better-auth/db/migration` (the deprecated
# `@better-auth/cli` could not load this repo's config).
pnpm --filter web exec tsx scripts/auth-migrate.ts
pnpm --filter web exec tsx scripts/auth-post-migrate.ts
