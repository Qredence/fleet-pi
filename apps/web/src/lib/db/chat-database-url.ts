/**
 * Resolves the chat Postgres URL.
 *
 * `FLEET_PI_CHAT_DATABASE_URL` (the non-owner `fleet_pi_app` role) wins when
 * set. `DATABASE_URL` remains a local-only fallback; deployed environments
 * must configure the dedicated URL.
 */
export function resolveChatDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const dedicated = env.FLEET_PI_CHAT_DATABASE_URL?.trim() ?? ""
  if (dedicated) return dedicated
  return env.DATABASE_URL?.trim() ?? ""
}
