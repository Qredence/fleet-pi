import { AUTH_POSTGRES_POST_MIGRATE_SQL } from "../db/auth-postgres-post-migrate"
import { CHAT_POSTGRES_MIGRATION_ID } from "../db/chat-postgres-schema"
import { CHAT_POSTGRES_RLS_STRICT_MIGRATION_ID } from "../db/chat-postgres-rls-strict"
import { CHAT_POSTGRES_SESSION_OWNERSHIP_MIGRATION_ID } from "../db/chat-postgres-session-ownership"
import { CHAT_POSTGRES_SESSION_TOMBSTONES_MIGRATION_ID } from "../db/chat-postgres-session-tombstones"
import { CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID } from "../db/chat-postgres-provider-auth"
import { CHAT_POSTGRES_USER_SETTINGS_MIGRATION_ID } from "../db/chat-postgres-user-settings"
import { CHAT_POSTGRES_DATA_API_REVOKE_MIGRATION_ID } from "../db/chat-postgres-data-api-revoke"
import { CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_MIGRATION_ID } from "../db/chat-postgres-ownership-execute-revoke"
import { resolveDeploymentTrustZone } from "./trust-zone"
import type { DeploymentTrustZone } from "./trust-zone"

export type ReadinessCheck = {
  id: string
  ok: boolean
  message: string
}

export type DeploymentReadinessInput = {
  trustZone?: DeploymentTrustZone
  env?: NodeJS.ProcessEnv
  chatMigrationsApplied?: Array<string>
  authTablesRlsDisabled?: boolean
  piSessionsRlsEnabled?: boolean
  ownershipProbePresent?: boolean
}

const LEGACY_REQUIRED_VERCEL_ENV_VARS = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "FLEET_PI_AUTH_DATABASE_URL",
  "FLEET_PI_CHAT_DATABASE_URL",
] as const

const NEON_MANAGED_REQUIRED_VERCEL_ENV_VARS = [
  "FLEET_PI_CHAT_DATABASE_URL",
] as const

const CHAT_MIGRATION_IDS = [
  CHAT_POSTGRES_MIGRATION_ID,
  CHAT_POSTGRES_RLS_STRICT_MIGRATION_ID,
  CHAT_POSTGRES_SESSION_OWNERSHIP_MIGRATION_ID,
  CHAT_POSTGRES_SESSION_TOMBSTONES_MIGRATION_ID,
  CHAT_POSTGRES_PROVIDER_AUTH_MIGRATION_ID,
  CHAT_POSTGRES_USER_SETTINGS_MIGRATION_ID,
  CHAT_POSTGRES_DATA_API_REVOKE_MIGRATION_ID,
  CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_MIGRATION_ID,
] as const

function readEnv(name: string, env: NodeJS.ProcessEnv) {
  return env[name]?.trim() ?? ""
}

function databaseUrlContainsMarker(url: string, marker: string) {
  return marker.length > 0 && url.includes(marker)
}

export function validateDeploymentReadiness(
  input: DeploymentReadinessInput = {}
): { ok: boolean; checks: Array<ReadinessCheck> } {
  const env = input.env ?? process.env
  const trustZone = input.trustZone ?? resolveDeploymentTrustZone()
  const checks: Array<ReadinessCheck> = []

  const push = (id: string, ok: boolean, message: string) => {
    checks.push({ id, ok, message })
  }

  if (trustZone === "local") {
    push(
      "local-mode",
      true,
      "Local development does not require Vercel env vars."
    )
    return { ok: checks.every((check) => check.ok), checks }
  }

  const neonAuthBase =
    readEnv("NEON_AUTH_BASE_URL", env) || readEnv("NEON_AUTH_URL", env)
  const neonManagedAuth = neonAuthBase.length > 0

  if (neonManagedAuth) {
    push(
      "env:NEON_AUTH_BASE_URL",
      true,
      readEnv("NEON_AUTH_BASE_URL", env).length > 0
        ? "NEON_AUTH_BASE_URL is set."
        : "NEON_AUTH_URL (Vercel↔Neon integration) is set; NEON_AUTH_BASE_URL optional."
    )

    for (const name of NEON_MANAGED_REQUIRED_VERCEL_ENV_VARS) {
      const value = readEnv(name, env)
      push(
        `env:${name}`,
        value.length > 0,
        value.length > 0 ? `${name} is set.` : `${name} is required on Vercel.`
      )
    }

    const cookieSecret =
      readEnv("NEON_AUTH_COOKIE_SECRET", env) ||
      readEnv("BETTER_AUTH_SECRET", env)
    push(
      "env:NEON_AUTH_COOKIE_SECRET",
      cookieSecret.length >= 32,
      cookieSecret.length >= 32
        ? "NEON_AUTH_COOKIE_SECRET (or BETTER_AUTH_SECRET fallback) is configured."
        : "NEON_AUTH_COOKIE_SECRET must be at least 32 characters."
    )

    const authDatabaseUrl = readEnv("FLEET_PI_AUTH_DATABASE_URL", env)
    const chatDatabaseUrl = readEnv("FLEET_PI_CHAT_DATABASE_URL", env)
    push(
      "neon:consolidated-database",
      authDatabaseUrl.length === 0 || authDatabaseUrl === chatDatabaseUrl,
      authDatabaseUrl.length === 0 || authDatabaseUrl === chatDatabaseUrl
        ? "Auth and chat databases are consolidated on fleet-pi-neon."
        : "When using Neon Managed Auth, FLEET_PI_AUTH_DATABASE_URL should match FLEET_PI_CHAT_DATABASE_URL."
    )

    const viteNeonAuthUrl = readEnv("VITE_NEON_AUTH_URL", env)
    push(
      "env:VITE_NEON_AUTH_URL",
      viteNeonAuthUrl.length > 0,
      viteNeonAuthUrl.length > 0
        ? "VITE_NEON_AUTH_URL is set for the browser auth client."
        : "VITE_NEON_AUTH_URL is required for client sign-in (server NEON_AUTH_URL alone is not enough)."
    )

    const neonAuthIssuer = readEnv("NEON_AUTH_ISSUER", env)
    push(
      "env:NEON_AUTH_ISSUER",
      neonAuthIssuer.length > 0,
      neonAuthIssuer.length > 0
        ? "NEON_AUTH_ISSUER is set so bearer JWTs fail closed."
        : "NEON_AUTH_ISSUER is required when Neon Managed Auth is configured."
    )
  } else {
    for (const name of LEGACY_REQUIRED_VERCEL_ENV_VARS) {
      const value = readEnv(name, env)
      if (name === "BETTER_AUTH_URL" && trustZone === "vercel-preview") {
        const vercelUrl = readEnv("VERCEL_URL", env)
        const ok = value.length > 0 || vercelUrl.length > 0
        push(
          `env:${name}`,
          ok,
          ok
            ? value.length > 0
              ? `${name} is set.`
              : `${name} falls back to VERCEL_URL on Preview.`
            : `${name} or VERCEL_URL is required on Preview.`
        )
        continue
      }

      push(
        `env:${name}`,
        value.length > 0,
        value.length > 0 ? `${name} is set.` : `${name} is required on Vercel.`
      )
    }
  }

  const trustedOrigins = readEnv("BETTER_AUTH_TRUSTED_ORIGINS", env)
  push(
    "env:BETTER_AUTH_TRUSTED_ORIGINS",
    trustedOrigins.length > 0 || trustZone === "vercel-production",
    trustedOrigins.length > 0
      ? "BETTER_AUTH_TRUSTED_ORIGINS is configured."
      : "Preview deployments should set BETTER_AUTH_TRUSTED_ORIGINS explicitly."
  )

  if (trustZone === "vercel-preview") {
    const previewZone = readEnv("FLEET_PI_DEPLOYMENT_TRUST_ZONE", env)
    push(
      "preview:trust-zone",
      previewZone === "preview",
      previewZone === "preview"
        ? "Preview trust zone marker is set."
        : "Set FLEET_PI_DEPLOYMENT_TRUST_ZONE=preview for Preview deployments."
    )

    const productionDbMarker = readEnv(
      "FLEET_PI_PRODUCTION_DATABASE_MARKER",
      env
    )
    const previewDbMarker = readEnv("FLEET_PI_PREVIEW_DATABASE_MARKER", env)
    const chatDatabaseUrl = readEnv("FLEET_PI_CHAT_DATABASE_URL", env)
    const authDatabaseUrl = readEnv("FLEET_PI_AUTH_DATABASE_URL", env)
    const productionChatUrl = readEnv(
      "FLEET_PI_PRODUCTION_CHAT_DATABASE_URL",
      env
    )
    const productionAuthUrl = readEnv(
      "FLEET_PI_PRODUCTION_AUTH_DATABASE_URL",
      env
    )

    push(
      "preview:database-marker",
      previewDbMarker.length > 0 &&
        (productionDbMarker.length === 0 ||
          previewDbMarker !== productionDbMarker),
      previewDbMarker.length > 0
        ? "Preview database marker is distinct from production."
        : "Set FLEET_PI_PREVIEW_DATABASE_MARKER to a non-production Neon identity."
    )

    push(
      "preview:chat-url-marker",
      databaseUrlContainsMarker(chatDatabaseUrl, previewDbMarker),
      databaseUrlContainsMarker(chatDatabaseUrl, previewDbMarker)
        ? "FLEET_PI_CHAT_DATABASE_URL includes the preview database marker."
        : "FLEET_PI_CHAT_DATABASE_URL must include FLEET_PI_PREVIEW_DATABASE_MARKER."
    )

    const authUrlForPreviewMarker =
      authDatabaseUrl.length > 0 ? authDatabaseUrl : chatDatabaseUrl
    const neonManagedAuthPreview =
      readEnv("NEON_AUTH_BASE_URL", env).length > 0 ||
      readEnv("NEON_AUTH_URL", env).length > 0
    push(
      "preview:auth-url-marker",
      databaseUrlContainsMarker(authUrlForPreviewMarker, previewDbMarker),
      databaseUrlContainsMarker(authUrlForPreviewMarker, previewDbMarker)
        ? neonManagedAuthPreview && authDatabaseUrl.length === 0
          ? "Auth DB omitted under Managed Auth; chat URL carries the preview marker."
          : "FLEET_PI_AUTH_DATABASE_URL includes the preview database marker."
        : "FLEET_PI_AUTH_DATABASE_URL (or chat URL when auth URL is omitted under Managed Auth) must include FLEET_PI_PREVIEW_DATABASE_MARKER."
    )

    const chatMatchesProduction =
      productionChatUrl.length > 0 && chatDatabaseUrl === productionChatUrl
    push(
      "preview:chat-url-not-production",
      !chatMatchesProduction,
      chatMatchesProduction
        ? "Preview FLEET_PI_CHAT_DATABASE_URL must not match production."
        : "Preview chat database URL is distinct from production."
    )

    const authMatchesProduction =
      productionAuthUrl.length > 0 &&
      authDatabaseUrl.length > 0 &&
      authDatabaseUrl === productionAuthUrl
    push(
      "preview:auth-url-not-production",
      !authMatchesProduction,
      authMatchesProduction
        ? "Preview FLEET_PI_AUTH_DATABASE_URL must not match production."
        : "Preview auth database URL is distinct from production."
    )
  }

  const chatRuntimeUrl =
    readEnv("VITE_FLEET_PI_CHAT_RUNTIME_URL", env) ||
    readEnv("FLEET_PI_CHAT_RUNTIME_URL", env)
  if (chatRuntimeUrl.length > 0) {
    const corsOrigins = readEnv("FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS", env)
    push(
      "env:FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS",
      corsOrigins.length > 0,
      corsOrigins.length > 0
        ? "Chat runtime CORS allowlist is configured for dual-host chat."
        : "Set FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS when VITE_FLEET_PI_CHAT_RUNTIME_URL is set."
    )

    // Issuer is already required under Neon Managed Auth above; when dual-host
    // runs without Managed Auth env on this host, still require issuer.
    if (!neonManagedAuth) {
      const neonAuthIssuer = readEnv("NEON_AUTH_ISSUER", env)
      push(
        "env:NEON_AUTH_ISSUER",
        neonAuthIssuer.length > 0,
        neonAuthIssuer.length > 0
          ? "NEON_AUTH_ISSUER is set for dual-host JWT verification."
          : "Set NEON_AUTH_ISSUER when VITE_FLEET_PI_CHAT_RUNTIME_URL is set so bearer JWTs fail closed."
      )
    }
  }
  if (input.chatMigrationsApplied) {
    for (const migrationId of CHAT_MIGRATION_IDS) {
      const applied = input.chatMigrationsApplied.includes(migrationId)
      push(
        `migration:${migrationId}`,
        applied,
        applied
          ? `${migrationId} is recorded in fleet_pi_chat_migrations.`
          : `Missing chat migration ${migrationId}; run pnpm chat:migrate.`
      )
    }
  }

  if (typeof input.authTablesRlsDisabled === "boolean") {
    push(
      "db:auth-rls-disabled",
      input.authTablesRlsDisabled,
      input.authTablesRlsDisabled
        ? "Better Auth tables have RLS disabled."
        : "Better Auth tables must not use RLS; run auth post-migrate."
    )
  }

  if (typeof input.piSessionsRlsEnabled === "boolean") {
    push(
      "db:pi-sessions-rls",
      input.piSessionsRlsEnabled,
      input.piSessionsRlsEnabled
        ? "pi_sessions row-level security is enabled."
        : "pi_sessions must use owner-bound RLS."
    )
  }

  if (typeof input.ownershipProbePresent === "boolean") {
    push(
      "db:ownership-probe",
      input.ownershipProbePresent,
      input.ownershipProbePresent
        ? "fleet_pi_check_session_owner is installed."
        : "Ownership probe migration is missing; run pnpm chat:migrate."
    )
  }

  push(
    "artifact:auth-post-migrate-sql",
    AUTH_POSTGRES_POST_MIGRATE_SQL.includes(
      'DROP TABLE IF EXISTS public."user"'
    ) ||
      (AUTH_POSTGRES_POST_MIGRATE_SQL.includes("ENABLE ROW LEVEL SECURITY") &&
        AUTH_POSTGRES_POST_MIGRATE_SQL.includes("fleet_pi_app_auth_access")),
    "Auth post-migrate drops legacy public auth tables under Managed Auth or enables fleet_pi_app-only RLS for legacy Better Auth."
  )

  return { ok: checks.every((check) => check.ok), checks }
}
