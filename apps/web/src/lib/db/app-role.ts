/**
 * The non-owner runtime role that chat:migrate / auth:migrate grant to.
 *
 * Defaults to `fleet_pi_app`; override with `FLEET_PI_APP_ROLE` (e.g. to
 * rotate onto a freshly created role in one hop, see
 * docs/runbooks/db-role-rotation.md). The migration SQL is written against
 * the literal name `fleet_pi_app`; `withAppRole` rewrites it for a custom role.
 */
export const DEFAULT_APP_ROLE = "fleet_pi_app"

/** Lower-case Postgres identifier, no quoting needed, not a reserved prefix. */
const SAFE_ROLE = /^[a-z_][a-z0-9_]{0,62}$/

export function assertSafeAppRole(role: string): string {
  if (!SAFE_ROLE.test(role) || role.startsWith("pg_")) {
    throw new Error(
      "FLEET_PI_APP_ROLE must be a lower-case Postgres identifier ([a-z_][a-z0-9_]*, max 63 chars, not pg_*)."
    )
  }
  return role
}

export function resolveAppRole(
  env: Record<string, string | undefined> = process.env
): string {
  const raw = env.FLEET_PI_APP_ROLE?.trim()
  return raw ? assertSafeAppRole(raw) : DEFAULT_APP_ROLE
}

const quoteIdent = (role: string) => `"${role.replace(/"/g, '""')}"`
const quoteLiteral = (role: string) => `'${role.replace(/'/g, "''")}'`

/**
 * Point SQL written for `fleet_pi_app` at `role`: `'fleet_pi_app'` literals
 * (e.g. `rolname = 'fleet_pi_app'`) become a quoted literal and bare
 * identifiers (`TO fleet_pi_app`) a quoted identifier. Longer names such as
 * the `fleet_pi_app_auth_access` policy are untouched. The default role
 * returns the SQL unchanged.
 */
export function withAppRole(sql: string, role: string): string {
  if (role === DEFAULT_APP_ROLE) return sql
  assertSafeAppRole(role)
  return sql
    .replace(/'fleet_pi_app'/g, quoteLiteral(role))
    .replace(/\bfleet_pi_app\b/g, quoteIdent(role))
}
