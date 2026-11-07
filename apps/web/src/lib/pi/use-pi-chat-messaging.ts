import { useCallback } from "react"
import { toast } from "sonner"

import {
  captureChatSessionStarted,
  captureConversationSaved,
} from "@/lib/analytics/posthog"

import { createTextMessage } from "./chat-message-helpers"
import { applyChatStreamEvent } from "./chat-stream-state"
import { hostedWhenBusy } from "./hosted-busy-delivery"
import { failChatRequest } from "./use-pi-chat-forbidden-session"

import type { ChatClient } from "./chat-client"
import type { QueueState } from "./chat-fetch"
import type { SendMessageInput } from "./use-pi-chat"
import type { ChatStateSetters } from "./use-pi-chat-forbidden-session"
import type {
  ChatMode,
  ChatModelSelection,
  ChatSessionMetadata,
  ChatStreamEvent,
} from "@workspace/pi-protocol/chat-protocol"
import type { ChatMessage, ChatStatus } from "@workspace/pi-protocol/chat-types"
import type { MutableRefObject } from "react"

type PiChatMessagingRefs = {
  abortRef: MutableRefObject<AbortController | null>
  followUpAbortRef: MutableRefObject<AbortController | null>
  activityLabelRef: MutableRefObject<string | undefined>
  messagesRef: MutableRefObject<Array<ChatMessage>>
  planLabelRef: MutableRefObject<string | undefined>
  queueRef: MutableRefObject<QueueState>
  sessionMetadataRef: MutableRefObject<ChatSessionMetadata>
}

export type UsePiChatMessagingOptions = PiChatMessagingRefs &
  ChatStateSetters & {
    client: ChatClient
    hostedAgentOnly?: boolean
    mode: ChatMode
    model: ChatModelSelection | undefined
    recoverFromForbiddenSession: () => Promise<void>
    refreshSessions: () => Promise<void>
    status: ChatStatus
    steeringMode?: string
  }

export function usePiChatMessaging({
  abortRef,
  followUpAbortRef,
  activityLabelRef,
  client,
  hostedAgentOnly = false,
  messagesRef,
  mode,
  model,
  planLabelRef,
  queueRef,
  recoverFromForbiddenSession,
  refreshSessions,
  sessionMetadataRef,
  setActivityLabelSynced,
  setError,
  setMessagesSynced,
  setPlanLabelSynced,
  setQueueSynced,
  setSessionMetadataSynced,
  setStatus,
  status,
  steeringMode,
}: UsePiChatMessagingOptions) {
  const handleStreamEvent = useCallback(
    (event: ChatStreamEvent, assistantIdRef: { current: string | null }) => {
      if (event.type === "error") {
        throw new Error(event.message)
      }

      const next = applyChatStreamEvent(
        {
          assistantId: assistantIdRef.current,
          snapshot: {
            activityLabel: activityLabelRef.current,
            messages: messagesRef.current,
            planLabel: planLabelRef.current,
            queue: queueRef.current,
            sessionMetadata: sessionMetadataRef.current,
          },
        },
        event
      )

      assistantIdRef.current = next.assistantId
      setMessagesSynced(next.snapshot.messages)
      setSessionMetadataSynced(next.snapshot.sessionMetadata)
      setQueueSynced(next.snapshot.queue)
      setActivityLabelSynced(next.snapshot.activityLabel)
      setPlanLabelSynced(next.snapshot.planLabel)

      if (event.type === "start") {
        setStatus("streaming")
      }

      if (event.type === "done") {
        setStatus("ready")
        void refreshSessions()
      }
    },
    [
      activityLabelRef,
      messagesRef,
      planLabelRef,
      queueRef,
      refreshSessions,
      sessionMetadataRef,
      setActivityLabelSynced,
      setMessagesSynced,
      setPlanLabelSynced,
      setQueueSynced,
      setSessionMetadataSynced,
      setStatus,
    ]
  )

  const queueFollowUp = useCallback(
    async (
      trimmed: string,
      requestMode: ChatMode,
      behavior: "steer" | "followUp"
    ) => {
      const userMessage = createTextMessage("user", trimmed)
      setMessagesSynced((current) => [...current, userMessage])
      setError(null)

      const controller = new AbortController()
      followUpAbortRef.current?.abort()
      followUpAbortRef.current = controller

      try {
        await client.streamMessage(
          {
            message: trimmed,
            model,
            mode: requestMode,
            sessionFile: sessionMetadataRef.current.sessionFile,
            sessionId: sessionMetadataRef.current.sessionId,
            streamingBehavior: behavior,
          },
          (event) => {
            if (event.type === "queue") {
              setQueueSynced({
                steering: event.steering,
                followUp: event.followUp,
              })
              setActivityLabelSynced(
                behavior === "steer" ? "Steering the turn" : "Follow-up queued"
              )
            }
            if (event.type === "error") {
              throw new Error(event.message)
            }
          },
          controller.signal
        )
      } catch (err) {
        if (controller.signal.aborted) return
        throw err
      } finally {
        if (followUpAbortRef.current === controller) {
          followUpAbortRef.current = null
        }
      }
    },
    [
      client,
      followUpAbortRef,
      model,
      sessionMetadataRef,
      setActivityLabelSynced,
      setError,
      setMessagesSynced,
      setQueueSynced,
    ]
  )

  const sendMessage = useCallback(
    async ({ text, mode: requestedMode, planAction }: SendMessageInput) => {
      const trimmed = text.trim()
      if (!trimmed || status === "submitted") return
      const requestMode = requestedMode ?? mode

      if (status === "streaming") {
        try {
          await queueFollowUp(
            trimmed,
            requestMode,
            hostedWhenBusy({ hostedAgentOnly, steeringMode })
          )
        } catch (err) {
          const nextError = err instanceof Error ? err : new Error(String(err))
          setError(nextError)
          toast.error(nextError.message)
        }
        return
      }

      const controller = new AbortController()
      followUpAbortRef.current?.abort()
      followUpAbortRef.current = null
      abortRef.current?.abort()
      abortRef.current = controller
      setError(null)
      setActivityLabelSynced(undefined)
      setStatus("submitted")

      if (messagesRef.current.length === 0) {
        captureChatSessionStarted({
          promptLength: trimmed.length,
          sessionId: sessionMetadataRef.current.sessionId,
        })
      }

      const userMessage = createTextMessage("user", trimmed)
      setMessagesSynced((current) => [...current, userMessage])
      const assistantIdRef = { current: null as string | null }

      try {
        await client.streamMessage(
          {
            message: trimmed,
            model,
            mode: requestMode,
            planAction,
            sessionFile: sessionMetadataRef.current.sessionFile,
            sessionId: sessionMetadataRef.current.sessionId,
          },
          (event) => handleStreamEvent(event, assistantIdRef),
          controller.signal
        )

        setStatus("ready")
        captureConversationSaved({
          messageCount: messagesRef.current.length,
          sessionId: sessionMetadataRef.current.sessionId,
        })
      } catch (err) {
        if (controller.signal.aborted) return
        await failChatRequest(err, recoverFromForbiddenSession, {
          setError,
          setStatus,
        })
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [
      abortRef,
      client,
      followUpAbortRef,
      handleStreamEvent,
      hostedAgentOnly,
      messagesRef,
      mode,
      model,
      queueFollowUp,
      recoverFromForbiddenSession,
      sessionMetadataRef,
      setActivityLabelSynced,
      setError,
      setMessagesSynced,
      setStatus,
      status,
      steeringMode,
    ]
  )

  return { handleStreamEvent, queueFollowUp, sendMessage }
}
