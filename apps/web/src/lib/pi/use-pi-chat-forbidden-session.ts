import { toast } from "sonner"
import { isForbiddenSessionError } from "./chat-fetch"
import { EMPTY_QUEUE_STATE } from "./chat-stream-state"
import type { ChatClient } from "./chat-client"
import type { ChatMessage, ChatStatus } from "@workspace/pi-protocol/chat-types"
import type { ChatSessionMetadata } from "@workspace/pi-protocol/chat-protocol"
import type { QueueState } from "./chat-fetch"

export type ChatStateSetters = {
  setActivityLabelSynced: (label: string | undefined) => void
  setError: (error: Error | null) => void
  setMessagesSynced: (
    updater:
      Array<ChatMessage> | ((current: Array<ChatMessage>) => Array<ChatMessage>)
  ) => void
  setPlanLabelSynced: (label: string | undefined) => void
  setQueueSynced: (queue: QueueState) => void
  setSessionMetadataSynced: (metadata: ChatSessionMetadata) => void
  setStatus: (status: ChatStatus) => void
}

export type ForbiddenSessionRecoveryDeps = ChatStateSetters & {
  client: ChatClient
  refreshSessions: () => Promise<void>
}

export async function runForbiddenSessionRecovery(
  deps: ForbiddenSessionRecoveryDeps
) {
  deps.setSessionMetadataSynced({})
  deps.setMessagesSynced([])
  deps.setQueueSynced(EMPTY_QUEUE_STATE)
  deps.setActivityLabelSynced(undefined)
  deps.setPlanLabelSynced(undefined)
  deps.setError(null)
  deps.setStatus("ready")

  const result = await deps.client.createSession()
  deps.setSessionMetadataSynced(result.session)
  deps.setMessagesSynced(result.messages)
  deps.setActivityLabelSynced(
    result.sessionReset ? "Started a fresh Pi session" : undefined
  )
  toast.message("Started a fresh session")
  await deps.refreshSessions()
}

export async function tryRecoverForbiddenSession(
  error: unknown,
  recover: () => Promise<void>,
  deps: Pick<ForbiddenSessionRecoveryDeps, "setError" | "setStatus">
) {
  if (!isForbiddenSessionError(error)) {
    return false
  }

  try {
    await recover()
  } catch (recoveryError) {
    const nextError =
      recoveryError instanceof Error
        ? recoveryError
        : new Error(String(recoveryError))
    deps.setError(nextError)
    deps.setStatus("error")
    toast.error(nextError.message)
  }

  return true
}

export async function failChatRequest(
  error: unknown,
  recoverFromForbiddenSession: () => Promise<void>,
  deps: Pick<ForbiddenSessionRecoveryDeps, "setError" | "setStatus">
) {
  if (
    await tryRecoverForbiddenSession(error, recoverFromForbiddenSession, deps)
  ) {
    return
  }

  const nextError = error instanceof Error ? error : new Error(String(error))
  deps.setError(nextError)
  deps.setStatus("error")
  toast.error(nextError.message)
}
