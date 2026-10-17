export type PostgresConnectionIdentity = {
  host: string
  database: string
  user: string
}

export type NeonAuthUrlBundle = {
  baseUrl: string
  jwksUrl: string
  issuer: string
}

/** Normalize Neon direct vs pooler hostnames to the same endpoint identity. */
export function normalizeNeonPostgresHostname(hostname: string) {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^([^.]+)-pooler\./, "$1.")
}

export function normalizeAuthBaseUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ""
  try {
    const parsed = new URL(trimmed)
    const path = parsed.pathname.replace(/\/$/, "") || ""
    return `${parsed.origin}${path}`.toLowerCase()
  } catch {
    return trimmed.toLowerCase()
  }
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
    const host = normalizeNeonPostgresHostname(url.hostname)
    if (!host || !database || !user) return undefined
    return { host, database, user }
  } catch {
    return undefined
  }
}

export function previewDatabaseMarkerFromConnectionUrl(
  connectionString: string
) {
  const identity = parsePostgresConnectionIdentity(connectionString)
  return identity?.host ?? ""
}

/**
 * Derive Neon Managed Auth URLs from a Postgres endpoint hostname.
 * `ep-….c-N.region.aws.neon.tech` → `https://ep-….neonauth.c-N.region.aws.neon.tech/<db>/auth`.
 */
export function neonAuthUrlsFromPostgresHostname(
  hostname: string,
  databaseName = "neondb"
): NeonAuthUrlBundle | undefined {
  const host = normalizeNeonPostgresHostname(hostname)
  if (!host || !host.includes(".neon.tech")) return undefined
  const authHost = host.replace(/^([^.]+)\./, "$1.neonauth.")
  if (authHost === host) return undefined
  const db = databaseName.trim() || "neondb"
  const baseUrl = `https://${authHost}/${db}/auth`
  return {
    baseUrl,
    jwksUrl: `${baseUrl}/.well-known/jwks.json`,
    issuer: baseUrl,
  }
}

export function neonAuthUrlsFromPostgresConnectionUrl(
  connectionString: string,
  databaseName?: string
): NeonAuthUrlBundle | undefined {
  const identity = parsePostgresConnectionIdentity(connectionString)
  if (!identity?.host) return undefined
  const db =
    (databaseName?.trim() ? databaseName.trim() : "") ||
    identity.database ||
    "neondb"
  return neonAuthUrlsFromPostgresHostname(identity.host, db)
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

/** True when auth hostname embeds the normalized Postgres endpoint id. */
export function previewAuthMatchesDatabaseUrl(
  authBaseUrl: string,
  connectionString: string
): boolean {
  const identity = parsePostgresConnectionIdentity(connectionString)
  if (!identity?.host) return false
  try {
    const authHost = new URL(authBaseUrl.trim()).hostname.toLowerCase()
    const endpointId = identity.host.split(".")[0] ?? ""
    if (!endpointId) return false
    return authHost.startsWith(`${endpointId}.neonauth.`)
  } catch {
    return false
  }
}
