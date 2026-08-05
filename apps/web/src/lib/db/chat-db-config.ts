/**
 * Shared chat database configuration check. Used by every store that can fall
 * back to a non-DB path so the "is the chat DB configured" predicate lives in
 * one place instead of being re-implemented per module.
 */
export function isChatDatabaseConfigured() {
  return Boolean(process.env.FLEET_PI_CHAT_DATABASE_URL?.trim())
}
