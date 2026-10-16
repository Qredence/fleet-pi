export const DURABLE_SESSION_PREFIX = "durable:"

export function durableSessionId(conversationId: string): string {
  return `${DURABLE_SESSION_PREFIX}${conversationId}`
}

export function isDurableSessionId(
  sessionId: string | undefined
): sessionId is string {
  return (
    typeof sessionId === "string" &&
    sessionId.startsWith(DURABLE_SESSION_PREFIX) &&
    sessionId.length > DURABLE_SESSION_PREFIX.length
  )
}

export function conversationIdFromDurableSession(sessionId: string): string {
  return sessionId.slice(DURABLE_SESSION_PREFIX.length)
}

export function isLegacyChatSession(input: {
  sessionFile?: string
  sessionId?: string
}): boolean {
  if (input.sessionFile && input.sessionFile.length > 0) return true
  if (input.sessionId && input.sessionId.length > 0) {
    return !isDurableSessionId(input.sessionId)
  }
  return false
}
