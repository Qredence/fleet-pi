const deletedSessionIds = new Set<string>()

export function markPiSessionDeleted(sessionId: string) {
  deletedSessionIds.add(sessionId)
}

export function isPiSessionDeleted(sessionId: string) {
  return deletedSessionIds.has(sessionId)
}
