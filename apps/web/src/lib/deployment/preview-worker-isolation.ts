import { DEFAULT_APP_ROLE } from "../db/app-role"

export class PreviewWorkerIsolationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PreviewWorkerIsolationError"
  }
}

export const PREVIEW_WORKER_SECRET_ALLOWLIST = [
  "FLEET_PI_CHAT_DATABASE_URL",
  "DATABASE_URL",
  "NEON_AUTH_BASE_URL",
  "NEON_AUTH_JWKS_URL",
  "NEON_AUTH_ISSUER",
  "NEON_AUTH_COOKIE_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_TRUSTED_ORIGINS",
] as const

export type PreviewWorkerSecretName =
  (typeof PREVIEW_WORKER_SECRET_ALLOWLIST)[number]

export type PostgresConnectionIdentity = {
  host: string
  database: string
  user: string
}

/** Branch name used by `.github/workflows/neon_workflow.yml`. */
export function previewNeonBranchName(prNumber: number | string) {
  return `preview/pr-${prNumber}`
}

/** Wrangler Preview name; matches legacy `pr-<number>` preview alias. */
export function previewWorkerName(prNumber: number | string) {
  return `pr-${prNumber}`
}

export function parsePostgresConnectionIdentity(
  connectionString: string
): PostgresConnectionIdentity | undefined {
  const trimmed = connectionString.trim()
  if (!trimmed) return undefined

  try {
    const normalized = trimmed.replace(/^postgres(ql)?:/i, "http:")
    const url = new URL(normalized)
    const database = url.pathname.replace(/^\//, "").split("/")[0] ?? ""
    const user = decodeURIComponent(url.username || "")
    const host = url.hostname
    if (!host || !database || !user) return undefined
    return { host, database, user }
  } catch {
    return undefined
  }
}

export function postgresConnectionIdentitiesEqual(
  left: string,
  right: string
): boolean {
  const leftId = parsePostgresConnectionIdentity(left)
  const rightId = parsePostgresConnectionIdentity(right)
  if (!leftId || !rightId) {
    return left.trim() === right.trim()
  }
  return (
    leftId.host === rightId.host &&
    leftId.database === rightId.database &&
    leftId.user === rightId.user
  )
}

export function assertPreviewChatDatabaseUrl(
  previewUrl: string,
  productionUrl: string
) {
  const preview = previewUrl.trim()
  const production = productionUrl.trim()

  if (!production) {
    throw new PreviewWorkerIsolationError(
      "FLEET_PI_PRODUCTION_CHAT_DATABASE_URL is required to refuse production database URLs."
    )
  }

  if (!preview) {
    throw new PreviewWorkerIsolationError(
      "Preview chat database URL is missing; refuse Worker preview upload."
    )
  }

  if (
    preview === production ||
    postgresConnectionIdentitiesEqual(preview, production)
  ) {
    throw new PreviewWorkerIsolationError(
      "Preview FLEET_PI_CHAT_DATABASE_URL must not match production (host, database, and role)."
    )
  }
}

export function assertPreviewAuthBaseUrl(
  previewBaseUrl: string,
  productionBaseUrl: string
) {
  const preview = previewBaseUrl.trim()
  const production = productionBaseUrl.trim()

  if (!preview) {
    throw new PreviewWorkerIsolationError(
      "Preview NEON_AUTH_BASE_URL is required for Cloudflare previews."
    )
  }

  if (!production) {
    throw new PreviewWorkerIsolationError(
      "FLEET_PI_PRODUCTION_NEON_AUTH_BASE_URL is required to refuse production auth URLs."
    )
  }

  if (preview === production) {
    throw new PreviewWorkerIsolationError(
      "Preview NEON_AUTH_BASE_URL must not match production."
    )
  }
}

export type PreviewWorkerSecretsInput = {
  previewChatDatabaseUrl: string
  productionChatDatabaseUrl: string
  previewNeonAuthBaseUrl: string
  productionNeonAuthBaseUrl: string
  previewNeonAuthJwksUrl: string
  previewNeonAuthIssuer: string
  neonAuthCookieSecret: string
  betterAuthSecret: string
  betterAuthUrl: string
  betterAuthTrustedOrigins: string
}

export function buildPreviewWorkerSecrets(
  input: PreviewWorkerSecretsInput
): Record<PreviewWorkerSecretName, string> {
  assertPreviewChatDatabaseUrl(
    input.previewChatDatabaseUrl,
    input.productionChatDatabaseUrl
  )
  assertPreviewAuthBaseUrl(
    input.previewNeonAuthBaseUrl,
    input.productionNeonAuthBaseUrl
  )

  const chat = input.previewChatDatabaseUrl.trim()
  const jwks = input.previewNeonAuthJwksUrl.trim()
  const issuer = input.previewNeonAuthIssuer.trim()
  const cookieSecret = input.neonAuthCookieSecret.trim()
  const betterAuthSecret = input.betterAuthSecret.trim()
  const betterAuthUrl = input.betterAuthUrl.trim()
  const trustedOrigins = input.betterAuthTrustedOrigins.trim()

  if (!jwks) {
    throw new PreviewWorkerIsolationError(
      "PREVIEW_NEON_AUTH_JWKS_URL is required for Cloudflare previews."
    )
  }
  if (!issuer) {
    throw new PreviewWorkerIsolationError(
      "PREVIEW_NEON_AUTH_ISSUER is required for Cloudflare previews."
    )
  }
  if (cookieSecret.length < 32) {
    throw new PreviewWorkerIsolationError(
      "PREVIEW_NEON_AUTH_COOKIE_SECRET must be at least 32 characters."
    )
  }
  if (betterAuthSecret.length < 32) {
    throw new PreviewWorkerIsolationError(
      "PREVIEW_BETTER_AUTH_SECRET must be at least 32 characters."
    )
  }
  if (!betterAuthUrl) {
    throw new PreviewWorkerIsolationError(
      "PREVIEW_WORKER_ORIGIN (BETTER_AUTH_URL) is required after wrangler preview."
    )
  }
  if (!trustedOrigins) {
    throw new PreviewWorkerIsolationError(
      "BETTER_AUTH_TRUSTED_ORIGINS must include the preview Worker origin."
    )
  }

  return {
    FLEET_PI_CHAT_DATABASE_URL: chat,
    DATABASE_URL: chat,
    NEON_AUTH_BASE_URL: input.previewNeonAuthBaseUrl.trim(),
    NEON_AUTH_JWKS_URL: jwks,
    NEON_AUTH_ISSUER: issuer,
    NEON_AUTH_COOKIE_SECRET: cookieSecret,
    BETTER_AUTH_SECRET: betterAuthSecret,
    BETTER_AUTH_URL: betterAuthUrl,
    BETTER_AUTH_TRUSTED_ORIGINS: trustedOrigins,
  }
}

export function findDisallowedPreviewSecretNames(
  secretNames: Array<string>
): Array<string> {
  const allowed = new Set<string>(PREVIEW_WORKER_SECRET_ALLOWLIST)
  return secretNames.filter((name) => !allowed.has(name))
}

export function findMissingPreviewSecretNames(
  secretNames: Array<string>
): Array<PreviewWorkerSecretName> {
  const present = new Set(secretNames)
  return PREVIEW_WORKER_SECRET_ALLOWLIST.filter((name) => !present.has(name))
}

export function assertPreviewSecretAllowlist(secretNames: Array<string>) {
  const extras = findDisallowedPreviewSecretNames(secretNames)
  if (extras.length > 0) {
    throw new PreviewWorkerIsolationError(
      `Preview Worker has secrets outside the allowlist: ${extras.join(", ")}.`
    )
  }

  const missing = findMissingPreviewSecretNames(secretNames)
  if (missing.length > 0) {
    throw new PreviewWorkerIsolationError(
      `Preview Worker is missing required secrets: ${missing.join(", ")}.`
    )
  }
}

export function parsePreviewDeployJson(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const record = payload as Record<string, unknown>
  const candidates = [
    record.preview_url,
    record.url,
    record.deployment_url,
    record.latest_url,
  ]
  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().replace(/\/$/, "")
    }
  }
  return undefined
}

export const NEON_PREVIEW_APP_ROLE = DEFAULT_APP_ROLE
export const NEON_PREVIEW_DATABASE_NAME = "neondb"
