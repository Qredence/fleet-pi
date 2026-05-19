#!/usr/bin/env bash
set -euo pipefail

if [ -z "${FLEET_PI_AUTH_MIGRATION_DATABASE_URL:-}" ]; then
  echo "Error: FLEET_PI_AUTH_MIGRATION_DATABASE_URL is not set" >&2
  echo "This variable must contain the neondb_owner connection string." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FLEET_PI_AUTH_DATABASE_URL="$FLEET_PI_AUTH_MIGRATION_DATABASE_URL" \
  npx @better-auth/cli@latest migrate --config "$REPO_ROOT/apps/web/src/lib/auth/server.ts" --yes
