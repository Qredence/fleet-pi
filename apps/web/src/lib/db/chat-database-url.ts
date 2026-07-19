/**
 * Resolves the chat Postgres URL. Neon Functions inject `DATABASE_URL`; Vercel
 * and local dev use `FLEET_PI_CHAT_DATABASE_URL`.
 */
export function resolveChatDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.FLEET_PI_CHAT_DATABASE_URL?.trim() || env.DATABASE_URL?.trim() || ""
  )
}
