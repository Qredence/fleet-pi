import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  appendAssistantDelta,
  createTextMessage,
  upsertAssistantThinkingPart,
  upsertAssistantToolPart,
} from "./chat-message-helpers"
import { chatClient } from "./chat-client"
import { labelForState } from "./chat-fetch"
import type { QueueState } from "./chat-fetch"
import type {
  ChatMessage,
  ChatStatus,
} from "@workspace/ui/components/agent-elements/chat-types"
import type {
  ChatMode,
  ChatModelSelection,
  ChatPlanAction,
  ChatQuestionAnswer,
  ChatSessionInfo,
  ChatSessionMetadata,
  ChatStreamEvent,
} from "./chat-protocol"
import type { ChatClient } from "./chat-client"

export type SendMessageInput = {
  text: string
  mode?: ChatMode
  planAction?: ChatPlanAction
}

export type UsePiChatOptions = {
  client?: ChatClient
  initialSessionMetadata: ChatSessionMetadata
  onModeChange?: (mode: ChatMode) => void
  persistSession: (metadata: ChatSessionMetadata) => void
}

export function usePiChat(
  model: ChatModelSelection | undefined,
  mode: ChatMode,
  options: UsePiChatOptions
) {
  const {
    client = chatClient,
    initialSessionMetadata,
    onModeChange,
    persistSession,
  } = options
  const [messages, setMessages] = useState<Array<ChatMessage>>([])
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [error, setError] = useState<Error | null>(null)
  const [sessionMetadata, setSessionMetadata] = useState<ChatSessionMetadata>(
    () => initialSessionMetadata
  )
  const [sessions, setSessions] = useState<Array<ChatSessionInfo>>([])
  const [activityLabel, setActivityLabel] = useState<string | undefined>()
  const [planLabel, setPlanLabel] = useState<string | undefined>()
  const [queue, setQueue] = useState<QueueState>({ steering: [], followUp: [] })
  const messagesRef = useRef(messages)
  const sessionMetadataRef = useRef(sessionMetadata)
  const abortRef = useRef<AbortController | null>(null)

  const setMessagesSynced = useCallback(
    (
      updater:
        | Array<ChatMessage>
        | ((current: Array<ChatMessage>) => Array<ChatMessage>)
    ) => {
      setMessages((current) => {
        const next = typeof updater === "function" ? updater(current) : updater
        messagesRef.current = next
        return next
      })
    },
    []
  )

  const setSessionMetadataSynced = useCallback(
    (metadata: ChatSessionMetadata) => {
      sessionMetadataRef.current = metadata
      setSessionMetadata(metadata)
      persistSession(metadata)
    },
    [persistSession]
  )

  const refreshSessions = useCallback(async () => {
    const nextSessions = await client.listSessions()
    setSessions(nextSessions)
  }, [client])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    sessionMetadataRef.current = sessionMetadata
  }, [sessionMetadata])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    void refreshSessions().catch((err) => {
      const nextError = err instanceof Error ? err : new Error(String(err))
      setError(nextError)
      toast.error(nextError.message)
    })
  }, [refreshSessions])

  useEffect(() => {
    if (
      !initialSessionMetadata.sessionFile &&
      !initialSessionMetadata.sessionId
    ) {
      return
    }

    let cancelled = false
    const loadStoredSession = async () => {
      const result = await client.loadSession(initialSessionMetadata)
      if (cancelled) return
      setSessionMetadataSynced(result.session)
      setMessagesSynced(result.messages)
    }

    void loadStoredSession().catch((err) => {
      if (!cancelled) {
        const nextError = err instanceof Error ? err : new Error(String(err))
        setError(nextError)
        toast.error(nextError.message)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    client,
    initialSessionMetadata.sessionFile,
    initialSessionMetadata.sessionId,
    setMessagesSynced,
    setSessionMetadataSynced,
  ])

  const handleStreamEvent = useCallback(
    (event: ChatStreamEvent, assistantIdRef: { current: string | null }) => {
      if (event.type === "start") {
        assistantIdRef.current = event.id
        setSessionMetadataSynced({
          sessionFile: event.sessionFile,
          sessionId: event.sessionId,
        })
        const assistantMessage = createTextMessage("assistant", "", event.id)
        setMessagesSynced((current) => [...current, assistantMessage])
        setStatus("streaming")
        if (event.sessionReset) {
          setActivityLabel("Started a fresh Pi session")
        } else if (event.diagnostics?.length) {
          setActivityLabel(event.diagnostics[0])
        }
        return
      }

      if (event.type === "delta" && assistantIdRef.current) {
        const activeAssistantId = assistantIdRef.current
        setMessagesSynced((current) =>
          appendAssistantDelta(current, activeAssistantId, event.text)
        )
        return
      }

      if (event.type === "thinking" && assistantIdRef.current) {
        const activeAssistantId = assistantIdRef.current
        setMessagesSynced((current) =>
          upsertAssistantThinkingPart(current, activeAssistantId, event.text)
        )
        return
      }

      if (event.type === "tool" && assistantIdRef.current) {
        const activeAssistantId = assistantIdRef.current
        setMessagesSynced((current) =>
          upsertAssistantToolPart(current, activeAssistantId, event.part)
        )
        return
      }

      if (event.type === "queue") {
        setQueue({ steering: event.steering, followUp: event.followUp })
        return
      }

      if (event.type === "plan") {
        setPlanLabel(event.message)
        return
      }

      if (event.type === "state") {
        setActivityLabel(labelForState(event.state.name))
        return
      }

      if (event.type === "compaction") {
        setActivityLabel(
          event.phase === "start" ? "Compacting session" : "Compaction finished"
        )
        return
      }

      if (event.type === "retry") {
        setActivityLabel(
          event.phase === "start"
            ? `Retrying request ${event.attempt}/${event.maxAttempts}`
            : event.success
              ? "Retry succeeded"
              : "Retry failed"
        )
        return
      }

      if (event.type === "done") {
        setSessionMetadataSynced({
          sessionFile: event.sessionFile,
          sessionId: event.sessionId,
        })
        setMessagesSynced((current) =>
          current.some((message) => message.id === event.message.id)
            ? current.map((message) =>
                message.id === event.message.id ? event.message : message
              )
            : [...current, event.message]
        )
        setQueue({ steering: [], followUp: [] })
        setActivityLabel(undefined)
        void refreshSessions()
        return
      }

      if (event.type === "error") {
        throw new Error(event.message)
      }
    },
    [refreshSessions, setMessagesSynced, setSessionMetadataSynced]
  )

  const queueFollowUp = useCallback(
    async (trimmed: string, requestMode: ChatMode) => {
      const userMessage = createTextMessage("user", trimmed)
      setMessagesSynced((current) => [...current, userMessage])
      setError(null)

      await client.streamMessage(
        {
          message: trimmed,
          model,
          mode: requestMode,
          sessionFile: sessionMetadataRef.current.sessionFile,
          sessionId: sessionMetadataRef.current.sessionId,
          streamingBehavior: "followUp",
        },
        (event) => {
          if (event.type === "queue") {
            setQueue({ steering: event.steering, followUp: event.followUp })
            setActivityLabel("Follow-up queued")
          }
          if (event.type === "error") {
            throw new Error(event.message)
          }
        }
      )
    },
    [client, model, setMessagesSynced]
  )

  const sendMessage = useCallback(
    async ({ text, mode: requestedMode, planAction }: SendMessageInput) => {
      const trimmed = text.trim()
      if (!trimmed || status === "submitted") return
      const requestMode = requestedMode ?? mode

      if (status === "streaming") {
        try {
          await queueFollowUp(trimmed, requestMode)
        } catch (err) {
          const nextError = err instanceof Error ? err : new Error(String(err))
          setError(nextError)
          toast.error(nextError.message)
        }
        return
      }

      const controller = new AbortController()
      abortRef.current?.abort()
      abortRef.current = controller
      setError(null)
      setActivityLabel(undefined)
      setStatus("submitted")

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
      } catch (err) {
        if (controller.signal.aborted) return
        const nextError = err instanceof Error ? err : new Error(String(err))
        setError(nextError)
        setStatus("error")
        toast.error(nextError.message)
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [
      client,
      handleStreamEvent,
      mode,
      model,
      queueFollowUp,
      setMessagesSynced,
      status,
    ]
  )

  const stop = useCallback(() => {
    void client.abortSession(sessionMetadataRef.current).catch(() => undefined)
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("ready")
    setActivityLabel(undefined)
  }, [client])

  const startNewSession = useCallback(async () => {
    const result = await client.createSession()
    setSessionMetadataSynced(result.session)
    setMessagesSynced([])
    setQueue({ steering: [], followUp: [] })
    setActivityLabel(undefined)
    setPlanLabel(undefined)
    toast.success("New session started")
    await refreshSessions()
  }, [client, refreshSessions, setMessagesSynced, setSessionMetadataSynced])

  const resumeSession = useCallback(
    async (metadata: ChatSessionMetadata) => {
      const result = await client.resumeSession(metadata)
      setSessionMetadataSynced(result.session)
      setMessagesSynced(result.messages)
      setQueue({ steering: [], followUp: [] })
      setActivityLabel(
        result.sessionReset ? "Started a fresh Pi session" : undefined
      )
      setPlanLabel(undefined)
      toast.success("Session resumed")
      await refreshSessions()
    },
    [client, refreshSessions, setMessagesSynced, setSessionMetadataSynced]
  )

  const sendMessageRef = useRef(sendMessage)
  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  const answerQuestion = useCallback(
    async ({
      toolCallId,
      answer,
    }: {
      toolCallId?: string
      answer: ChatQuestionAnswer
    }) => {
      const result = await client.answerQuestion({
        sessionFile: sessionMetadataRef.current.sessionFile,
        sessionId: sessionMetadataRef.current.sessionId,
        toolCallId,
        answer,
      })

      if (result.mode) {
        onModeChange?.(result.mode)
      }
      if (result.message) {
        await sendMessageRef.current({
          text: result.message,
          mode: result.mode,
          planAction: result.planAction,
        })
      }

      return result
    },
    [client, onModeChange]
  )

  return {
    activityLabel,
    answerQuestion,
    error,
    messages,
    planLabel,
    queue,
    refreshSessions,
    resumeSession,
    sendMessage,
    sessionMetadata,
    sessions,
    setError,
    startNewSession,
    status,
    stop,
  }
}
