import { getChatAuthSurface } from "../auth/chat-auth-surface"

/**
 * Resolves the chat Postgres URL.
 *
 * The Neon Function must use `FLEET_PI_CHAT_DATABASE_URL` (the non-owner
 * `fleet_pi_app` role). `DATABASE_URL` on that surface is often the owner
 * and bypasses row-level security, so it is not a fallback there. Other
 * surfaces still accept `DATABASE_URL` when the dedicated URL is unset.
 */
export function resolveChatDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const dedicated = env.FLEET_PI_CHAT_DATABASE_URL?.trim() ?? ""
  if (dedicated) return dedicated
  if (getChatAuthSurface() === "neon-function") return ""
  return env.DATABASE_URL?.trim() ?? ""
}
