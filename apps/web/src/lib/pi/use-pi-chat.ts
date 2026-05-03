import { useCallback, useEffect, useRef, useState } from "react"
import {
  appendAssistantDelta,
  createTextMessage,
  upsertAssistantThinkingPart,
  upsertAssistantToolPart,
} from "./chat-message-helpers"
import {
  fetchJson,
  labelForState,
  metadataUrl,
  readChatStream,
} from "./chat-fetch"
import type { QueueState } from "./chat-fetch"
import type {
  ChatMessage,
  ChatStatus,
} from "@workspace/ui/components/agent-elements/chat-types"
import type { DesktopContext } from "@/lib/desktop/types"
import type {
  ChatMode,
  ChatModelSelection,
  ChatPlanAction,
  ChatSessionInfo,
  ChatSessionMetadata,
  ChatSessionResponse,
  ChatStreamEvent,
} from "./chat-protocol"
import { withDesktopHeaders } from "@/lib/desktop/client"

export type ChatSessionsResponse = {
  sessions: Array<ChatSessionInfo>
}

export type SendMessageInput = {
  text: string
  mode?: ChatMode
  planAction?: ChatPlanAction
}

export type UsePiChatOptions = {
  desktopContext?: DesktopContext
  initialSessionMetadata: ChatSessionMetadata
  persistSession: (metadata: ChatSessionMetadata) => void
}

export function usePiChat(
  model: ChatModelSelection | undefined,
  mode: ChatMode,
  options: UsePiChatOptions
) {
  const { desktopContext, initialSessionMetadata, persistSession } = options
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
    const result = await fetchJson<ChatSessionsResponse>(
      "/api/chat/sessions",
      desktopContext
    )
    setSessions(result.sessions)
  }, [desktopContext])

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
      setError(err instanceof Error ? err : new Error(String(err)))
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
      const result = await fetchJson<ChatSessionResponse>(
        `/api/chat/session?${metadataUrl(initialSessionMetadata)}`,
        desktopContext
      )
      if (cancelled) return
      setSessionMetadataSynced(result.session)
      setMessagesSynced(result.messages)
    }

    void loadStoredSession().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    desktopContext,
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

      const response = await fetch(
        "/api/chat",
        withDesktopHeaders(
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmed,
              model,
              mode: requestMode,
              sessionFile: sessionMetadataRef.current.sessionFile,
              sessionId: sessionMetadataRef.current.sessionId,
              streamingBehavior: "followUp",
            }),
          },
          desktopContext
        )
      )

      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || `Chat request failed (${response.status})`)
      }

      await readChatStream(response, (event) => {
        if (event.type === "queue") {
          setQueue({ steering: event.steering, followUp: event.followUp })
          setActivityLabel("Follow-up queued")
        }
        if (event.type === "error") {
          throw new Error(event.message)
        }
      })
    },
    [desktopContext, model, setMessagesSynced]
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
          setError(err instanceof Error ? err : new Error(String(err)))
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
        const response = await fetch(
          "/api/chat",
          withDesktopHeaders(
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: trimmed,
                model,
                mode: requestMode,
                planAction,
                sessionFile: sessionMetadataRef.current.sessionFile,
                sessionId: sessionMetadataRef.current.sessionId,
              }),
              signal: controller.signal,
            },
            desktopContext
          )
        )

        if (!response.ok) {
          const body = await response.text()
          throw new Error(body || `Chat request failed (${response.status})`)
        }

        await readChatStream(response, (event) =>
          handleStreamEvent(event, assistantIdRef)
        )

        setStatus("ready")
      } catch (err) {
        if (controller.signal.aborted) return
        const nextError = err instanceof Error ? err : new Error(String(err))
        setError(nextError)
        setStatus("error")
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [
      desktopContext,
      handleStreamEvent,
      mode,
      model,
      queueFollowUp,
      setMessagesSynced,
      status,
    ]
  )

  const stop = useCallback(() => {
    void fetch(
      "/api/chat/abort",
      withDesktopHeaders(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionMetadataRef.current),
        },
        desktopContext
      )
    ).catch(() => undefined)
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("ready")
    setActivityLabel(undefined)
  }, [desktopContext])

  const startNewSession = useCallback(async () => {
    const result = await fetchJson<ChatSessionResponse>(
      "/api/chat/new",
      desktopContext,
      { method: "POST" }
    )
    setSessionMetadataSynced(result.session)
    setMessagesSynced([])
    setQueue({ steering: [], followUp: [] })
    setActivityLabel(undefined)
    setPlanLabel(undefined)
    await refreshSessions()
  }, [
    desktopContext,
    refreshSessions,
    setMessagesSynced,
    setSessionMetadataSynced,
  ])

  const resumeSession = useCallback(
    async (metadata: ChatSessionMetadata) => {
      const result = await fetchJson<ChatSessionResponse>(
        "/api/chat/resume",
        desktopContext,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metadata),
        }
      )
      setSessionMetadataSynced(result.session)
      setMessagesSynced(result.messages)
      setQueue({ steering: [], followUp: [] })
      setActivityLabel(
        result.sessionReset ? "Started a fresh Pi session" : undefined
      )
      setPlanLabel(undefined)
      await refreshSessions()
    },
    [
      desktopContext,
      refreshSessions,
      setMessagesSynced,
      setSessionMetadataSynced,
    ]
  )

  return {
    activityLabel,
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
