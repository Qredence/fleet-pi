import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { createTextMessage } from "./chat-message-helpers"
import { chatClient } from "./chat-client"
import { isPlanDecisionToolCall } from "./plan-state"
import { EMPTY_QUEUE_STATE, applyChatStreamEvent } from "./chat-stream-state"
import { getChatSessionScope } from "./use-chat-storage"
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

type QuestionAnswerHandler = (input: {
  toolCallId?: string
  answer: ChatQuestionAnswer
}) => Promise<unknown>

function resolvePlanDecisionMessages(
  currentMessages: Array<ChatMessage>,
  toolCallId: string | undefined,
  answer: ChatQuestionAnswer
) {
  if (!isPlanDecisionToolCall(toolCallId)) return currentMessages

  const nextMessages = currentMessages.map((message) => {
    const nextParts = message.parts.map((part) => {
      if (
        part.type !== "tool-PlanWrite" ||
        part.toolCallId !== toolCallId ||
        !part.input ||
        typeof part.input !== "object"
      ) {
        return part
      }

      return {
        ...part,
        input: {
          ...(part.input as Record<string, unknown>),
          approved:
            answer.selectedIds?.[0] === "execute" ||
            answer.selectedIds?.[0] === "stay",
          pendingDecision: false,
        },
      }
    })

    const partsChanged = nextParts.some(
      (part, index) => part !== message.parts[index]
    )
    if (!partsChanged) return message
    return { ...message, parts: nextParts }
  })

  return nextMessages.some(
    (message, index) => message !== currentMessages[index]
  )
    ? nextMessages
    : currentMessages
}

function enhancePlanDecisionMessages(
  currentMessages: Array<ChatMessage>,
  submitQuestionAnswer: QuestionAnswerHandler
) {
  const nextMessages = currentMessages.map((message) => {
    const nextParts = message.parts.map((part) => {
      if (
        part.type !== "tool-PlanWrite" ||
        typeof part.toolCallId !== "string"
      ) {
        return part
      }
      if (!part.input || typeof part.input !== "object") return part

      const input = part.input as Record<string, unknown>
      if (input.pendingDecision !== true) return part

      const hasPlanActionHandlers =
        typeof input.onExecute === "function" &&
        typeof input.onStay === "function" &&
        typeof input.onRefine === "function"
      if (hasPlanActionHandlers) return part

      return {
        ...part,
        input: {
          ...input,
          onExecute: () =>
            submitQuestionAnswer({
              toolCallId: part.toolCallId,
              answer: { kind: "single", selectedIds: ["execute"] },
            }),
          onStay: () =>
            submitQuestionAnswer({
              toolCallId: part.toolCallId,
              answer: { kind: "single", selectedIds: ["stay"] },
            }),
          onRefine: (instructions?: string) =>
            submitQuestionAnswer({
              toolCallId: part.toolCallId,
              answer:
                instructions && instructions.trim().length > 0
                  ? { kind: "text", text: instructions.trim() }
                  : { kind: "single", selectedIds: ["refine"] },
            }),
        },
      }
    })

    const partsChanged = nextParts.some(
      (part, index) => part !== message.parts[index]
    )
    if (!partsChanged) return message
    return { ...message, parts: nextParts }
  })

  return nextMessages.some(
    (message, index) => message !== currentMessages[index]
  )
    ? nextMessages
    : currentMessages
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
  const [queue, setQueue] = useState<QueueState>(EMPTY_QUEUE_STATE)
  const sessionScope = getChatSessionScope(mode)
  const initialSessionMetadataRef = useRef(initialSessionMetadata)
  const messagesRef = useRef(messages)
  const sessionMetadataRef = useRef(sessionMetadata)
  const activityLabelRef = useRef(activityLabel)
  const planLabelRef = useRef(planLabel)
  const queueRef = useRef(queue)
  const abortRef = useRef<AbortController | null>(null)
  const sendMessageRef = useRef<(input: SendMessageInput) => Promise<void>>(
    () => Promise.resolve()
  )
  const enhanceMessagesRef = useRef((current: Array<ChatMessage>) => current)

  const setMessagesSynced = useCallback(
    (
      updater:
        | Array<ChatMessage>
        | ((current: Array<ChatMessage>) => Array<ChatMessage>)
    ) => {
      setMessages((current) => {
        const next = typeof updater === "function" ? updater(current) : updater
        const enhanced = enhanceMessagesRef.current(next)
        messagesRef.current = enhanced
        return enhanced
      })
    },
    []
  )

  const setSessionMetadataSynced = useCallback(
    (metadata: ChatSessionMetadata) => {
      if (
        sessionMetadataRef.current.sessionFile === metadata.sessionFile &&
        sessionMetadataRef.current.sessionId === metadata.sessionId
      ) {
        return
      }

      sessionMetadataRef.current = metadata
      setSessionMetadata(metadata)
      persistSession(metadata)
    },
    [persistSession]
  )

  const setActivityLabelSynced = useCallback(
    (nextLabel: string | undefined) => {
      activityLabelRef.current = nextLabel
      setActivityLabel(nextLabel)
    },
    []
  )

  const setPlanLabelSynced = useCallback((nextLabel: string | undefined) => {
    planLabelRef.current = nextLabel
    setPlanLabel(nextLabel)
  }, [])

  const setQueueSynced = useCallback((nextQueue: QueueState) => {
    queueRef.current = nextQueue
    setQueue(nextQueue)
  }, [])

  const refreshSessions = useCallback(async () => {
    const nextSessions = await client.listSessions()
    setSessions(nextSessions)
  }, [client])

  initialSessionMetadataRef.current = initialSessionMetadata

  const submitQuestionAnswer = useCallback(
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
      if (result.ok && isPlanDecisionToolCall(toolCallId)) {
        setMessagesSynced((current) =>
          resolvePlanDecisionMessages(current, toolCallId, answer)
        )
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

  const enhanceMessages = useCallback(
    (currentMessages: Array<ChatMessage>) =>
      enhancePlanDecisionMessages(currentMessages, submitQuestionAnswer),
    [submitQuestionAnswer]
  )

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
    enhanceMessagesRef.current = enhanceMessages
    setMessagesSynced((current) => current)
  }, [enhanceMessages, setMessagesSynced])

  useEffect(() => {
    void refreshSessions().catch((err) => {
      const nextError = err instanceof Error ? err : new Error(String(err))
      setError(nextError)
      toast.error(nextError.message)
    })
  }, [refreshSessions])

  useEffect(() => {
    let cancelled = false
    const loadActiveSession = async () => {
      abortRef.current?.abort()
      abortRef.current = null
      setStatus("ready")
      setError(null)
      setQueueSynced(EMPTY_QUEUE_STATE)
      setActivityLabelSynced(undefined)
      setPlanLabelSynced(undefined)
      setMessagesSynced([])

      const storedSession = initialSessionMetadataRef.current
      const hasStoredSession =
        storedSession.sessionFile || storedSession.sessionId
      if (!hasStoredSession) {
        setSessionMetadataSynced({})
        return
      }

      const result = await client.loadSession(storedSession)
      if (cancelled) return
      setSessionMetadataSynced(result.session)
      setMessagesSynced(result.messages)
      setActivityLabelSynced(
        result.sessionReset ? "Started a fresh Pi session" : undefined
      )
    }

    void loadActiveSession().catch((err) => {
      if (!cancelled) {
        const nextError = err instanceof Error ? err : new Error(String(err))
        setError(nextError)
        setStatus("error")
        toast.error(nextError.message)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    client,
    sessionScope,
    setActivityLabelSynced,
    setMessagesSynced,
    setPlanLabelSynced,
    setQueueSynced,
    setSessionMetadataSynced,
  ])

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
        void refreshSessions()
      }
    },
    [
      refreshSessions,
      setActivityLabelSynced,
      setMessagesSynced,
      setPlanLabelSynced,
      setQueueSynced,
      setSessionMetadataSynced,
    ]
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
            setQueueSynced({
              steering: event.steering,
              followUp: event.followUp,
            })
            setActivityLabelSynced("Follow-up queued")
          }
          if (event.type === "error") {
            throw new Error(event.message)
          }
        }
      )
    },
    [client, model, setActivityLabelSynced, setMessagesSynced, setQueueSynced]
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
      setActivityLabelSynced(undefined)
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
    setActivityLabelSynced(undefined)
  }, [client, setActivityLabelSynced])

  const startNewSession = useCallback(async () => {
    const result = await client.createSession()
    setSessionMetadataSynced(result.session)
    setMessagesSynced([])
    setQueueSynced(EMPTY_QUEUE_STATE)
    setActivityLabelSynced(undefined)
    setPlanLabelSynced(undefined)
    toast.success("New session started")
    await refreshSessions()
  }, [
    client,
    refreshSessions,
    setActivityLabelSynced,
    setMessagesSynced,
    setPlanLabelSynced,
    setQueueSynced,
    setSessionMetadataSynced,
  ])

  const resumeSession = useCallback(
    async (metadata: ChatSessionMetadata) => {
      const result = await client.resumeSession(metadata)
      setSessionMetadataSynced(result.session)
      setMessagesSynced(result.messages)
      setQueueSynced(EMPTY_QUEUE_STATE)
      setActivityLabelSynced(
        result.sessionReset ? "Started a fresh Pi session" : undefined
      )
      setPlanLabelSynced(undefined)
      toast.success("Session resumed")
      await refreshSessions()
    },
    [
      client,
      refreshSessions,
      setActivityLabelSynced,
      setMessagesSynced,
      setPlanLabelSynced,
      setQueueSynced,
      setSessionMetadataSynced,
    ]
  )

  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  const answerQuestion = submitQuestionAnswer

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
