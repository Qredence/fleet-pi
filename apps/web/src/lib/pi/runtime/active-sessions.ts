import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent"

export type ActiveSessionRecord = {
  runtime: AgentSessionRuntime
  sessionFile?: string
  sessionId: string
  userId?: string
  lastUsedAt: number
  disposeTimer?: ReturnType<typeof setTimeout>
}

const activeSessionRecords = new Map<string, ActiveSessionRecord>()

export function getActiveSessionRecords() {
  return activeSessionRecords
}

export function setActiveSessionRecord(
  sessionId: string,
  record: ActiveSessionRecord
) {
  activeSessionRecords.set(sessionId, record)
}

export function deleteActiveSessionRecord(sessionId: string) {
  activeSessionRecords.delete(sessionId)
}

export function hasOtherActiveSessionForUser(
  userId: string,
  excludeSessionId?: string
) {
  for (const active of activeSessionRecords.values()) {
    if (active.userId === userId && active.sessionId !== excludeSessionId) {
      return true
    }
  }
  return false
}
