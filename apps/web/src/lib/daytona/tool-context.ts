const sessionUsers = new Map<string, string>()

export function trackDaytonaToolSession(
  sessionId: string,
  sessionFile: string | undefined,
  userId: string | undefined
) {
  if (!userId) return
  sessionUsers.set(sessionId, userId)
  if (sessionFile) sessionUsers.set(sessionFile, userId)
}

export function untrackDaytonaToolSession(
  sessionId: string,
  sessionFile: string | undefined
) {
  sessionUsers.delete(sessionId)
  if (sessionFile) sessionUsers.delete(sessionFile)
}

export function resolveDaytonaToolUser(
  sessionId: string | undefined,
  sessionFile: string | undefined
) {
  return (
    (sessionId ? sessionUsers.get(sessionId) : undefined) ??
    (sessionFile ? sessionUsers.get(sessionFile) : undefined)
  )
}
