import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { chatClient } from "./chat-client"
import { isPlanDecisionToolCall } from "./plan-state"
import { EMPTY_QUEUE_STATE } from "./chat-stream-state"
import { getChatSessionScope } from "./use-chat-storage"
import {
  runForbiddenSessionRecovery,
  tryRecoverForbiddenSession,
} from "./use-pi-chat-forbidden-session"
import { usePiChatMessaging } from "./use-pi-chat-messaging"
import {
  enhancePlanDecisionMessages,
  resolvePlanDecisionMessages,
} from "./use-pi-chat-plan-decisions"
import type { QueueState } from "./chat-fetch"
import type { ChatMessage, ChatStatus } from "@workspace/pi-protocol/chat-types"
import type {
  ChatMode,
  ChatModelSelection,
  ChatPlanAction,
  ChatQuestionAnswer,
  ChatSessionInfo,
  ChatSessionMetadata,
} from "@workspace/pi-protocol/chat-protocol"
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

  const recoverFromForbiddenSession = useCallback(
    () =>
      runForbiddenSessionRecovery({
        client,
        refreshSessions,
        setActivityLabelSynced,
        setError,
        setMessagesSynced,
        setPlanLabelSynced,
        setQueueSynced,
        setSessionMetadataSynced,
        setStatus,
      }),
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

    void loadActiveSession().catch(async (err) => {
      if (cancelled) return
      if (
        await tryRecoverForbiddenSession(err, recoverFromForbiddenSession, {
          setError,
          setStatus,
        })
      ) {
        return
      }

      const nextError = err instanceof Error ? err : new Error(String(err))
      setError(nextError)
      setStatus("error")
      toast.error(nextError.message)
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
    recoverFromForbiddenSession,
  ])

  const { sendMessage } = usePiChatMessaging({
    abortRef,
    activityLabelRef,
    client,
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
  })

  const stop = useCallback(() => {
    void client.abortSession(sessionMetadataRef.current).catch(() => undefined)
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("ready")
    setQueueSynced(EMPTY_QUEUE_STATE)
    setActivityLabelSynced(undefined)
  }, [client, setActivityLabelSynced, setQueueSynced])

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
      try {
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
      } catch (err) {
        if (
          await tryRecoverForbiddenSession(err, recoverFromForbiddenSession, {
            setError,
            setStatus,
          })
        ) {
          return
        }
        const nextError = err instanceof Error ? err : new Error(String(err))
        setError(nextError)
        setStatus("error")
        toast.error(nextError.message)
      }
    },
    [
      client,
      recoverFromForbiddenSession,
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
