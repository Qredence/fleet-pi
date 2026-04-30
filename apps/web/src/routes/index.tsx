import { createFileRoute } from "@tanstack/react-router"
import { Bot, ClipboardList, History, Plus, Square } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AgentChat } from "@workspace/ui/components/agent-elements/agent-chat"
import { InputBar } from "@workspace/ui/components/agent-elements/input-bar"
import { ModelPicker } from "@workspace/ui/components/agent-elements/input/model-picker"
import { ModeSelector } from "@workspace/ui/components/agent-elements/input/mode-selector"
import { SpiralLoader } from "@workspace/ui/components/agent-elements/spiral-loader"
import type { PointerEvent as ReactPointerEvent } from "react"
import type {
  ChatMessage,
  ChatStatus,
  ChatToolPart,
} from "@workspace/ui/components/agent-elements/chat-types"
import type { QuestionAnswer } from "@workspace/ui/components/agent-elements/question/question-prompt"
import type { ModelOption } from "@workspace/ui/components/agent-elements/types"
import type {
  ChatMode,
  ChatModelInfo,
  ChatModelSelection,
  ChatModelsResponse,
  ChatPlanAction,
  ChatQuestionAnswerResponse,
  ChatResourcesResponse,
  ChatSessionInfo,
  ChatSessionMetadata,
  ChatSessionResponse,
  ChatStreamEvent,
} from "@/lib/pi/chat-protocol"
import {
  ResourceCanvas,
  ResourceLauncher,
  ResourceMobilePanel,
  clampResourceCanvasWidth,
  readStoredResourceCanvasWidth,
  storeResourceCanvasWidth,
} from "@/components/pi/resource-library"

export const Route = createFileRoute("/")({ component: Chat })

type ChatModelOption = ModelOption & {
  provider: string
  modelId: string
  thinkingLevel?: ChatModelInfo["defaultThinkingLevel"]
}

type ChatSessionsResponse = {
  sessions: Array<ChatSessionInfo>
}

type QueueState = {
  steering: Array<string>
  followUp: Array<string>
}

const CHAT_SESSION_STORAGE_KEY = "fleet-pi-chat-session"
const CHAT_MODE_STORAGE_KEY = "fleet-pi-chat-mode"
const CHAT_MODES = [
  {
    id: "agent",
    label: "Agent",
    icon: Bot,
    description: "Full tool access",
  },
  {
    id: "plan",
    label: "Plan",
    icon: ClipboardList,
    description: "Read-only planning",
  },
]

function createTextMessage(
  role: ChatMessage["role"],
  text: string,
  id: string = crypto.randomUUID()
): ChatMessage {
  return {
    id,
    role,
    createdAt: Date.now(),
    parts: [{ type: "text", text }],
  }
}

function appendAssistantDelta(
  messages: Array<ChatMessage>,
  assistantId: string,
  delta: string
) {
  return messages.map((message) => {
    if (message.id !== assistantId) return message
    const parts = [...message.parts]
    const textIndex = parts.findIndex((part) => part.type === "text")

    if (textIndex === -1) {
      return { ...message, parts: [...parts, { type: "text", text: delta }] }
    }

    const part = parts[textIndex]
    parts[textIndex] =
      part.type === "text" ? { ...part, text: `${part.text}${delta}` } : part
    return { ...message, parts }
  })
}

function upsertAssistantToolPart(
  messages: Array<ChatMessage>,
  assistantId: string,
  toolPart: ChatToolPart
) {
  return messages.map((message) => {
    if (message.id !== assistantId) return message

    const toolIndex = message.parts.findIndex((part) => {
      return (
        part.type === toolPart.type &&
        "toolCallId" in part &&
        part.toolCallId === toolPart.toolCallId
      )
    })

    if (toolIndex === -1) {
      const textIndex = message.parts.findIndex((part) => part.type === "text")
      const parts =
        textIndex === -1
          ? [...message.parts, toolPart]
          : [
              ...message.parts.slice(0, textIndex),
              toolPart,
              ...message.parts.slice(textIndex),
            ]

      return { ...message, parts }
    }

    const parts = [...message.parts]
    parts[toolIndex] = { ...parts[toolIndex], ...toolPart }
    return { ...message, parts }
  })
}

function upsertAssistantThinkingPart(
  messages: Array<ChatMessage>,
  assistantId: string,
  thought: string
) {
  return upsertAssistantToolPart(messages, assistantId, {
    type: "tool-Thinking",
    toolCallId: "thinking",
    state: "input-streaming",
    input: { thought },
    output: thought,
  })
}

function readStoredSession(): ChatSessionMetadata {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ChatSessionMetadata
    return {
      sessionFile:
        typeof parsed.sessionFile === "string" ? parsed.sessionFile : undefined,
      sessionId:
        typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
    }
  } catch {
    return {}
  }
}

function storeSession(metadata: ChatSessionMetadata) {
  if (typeof window === "undefined") return

  if (!metadata.sessionFile && !metadata.sessionId) {
    window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(
    CHAT_SESSION_STORAGE_KEY,
    JSON.stringify(metadata)
  )
}

function readStoredMode(): ChatMode {
  if (typeof window === "undefined") return "agent"
  return window.localStorage.getItem(CHAT_MODE_STORAGE_KEY) === "plan"
    ? "plan"
    : "agent"
}

function storeMode(mode: ChatMode) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CHAT_MODE_STORAGE_KEY, mode)
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

async function readChatStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void
) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Chat response did not include a stream")

  const decoder = new TextDecoder()
  let buffer = ""

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    onEvent(JSON.parse(trimmed) as ChatStreamEvent)
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIndex = buffer.indexOf("\n")
    while (newlineIndex >= 0) {
      handleLine(buffer.slice(0, newlineIndex))
      buffer = buffer.slice(newlineIndex + 1)
      newlineIndex = buffer.indexOf("\n")
    }
  }

  buffer += decoder.decode()
  handleLine(buffer)
}

function metadataUrl(metadata: ChatSessionMetadata) {
  const params = new URLSearchParams()
  if (metadata.sessionFile) params.set("sessionFile", metadata.sessionFile)
  if (metadata.sessionId) params.set("sessionId", metadata.sessionId)
  return params.toString()
}

type SendMessageInput = {
  text: string
  mode?: ChatMode
  planAction?: ChatPlanAction
}

function usePiChat(model: ChatModelSelection | undefined, mode: ChatMode) {
  const [messages, setMessages] = useState<Array<ChatMessage>>([])
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [error, setError] = useState<Error | null>(null)
  const [sessionMetadata, setSessionMetadata] = useState<ChatSessionMetadata>(
    () => readStoredSession()
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
      storeSession(metadata)
    },
    []
  )

  const refreshSessions = useCallback(async () => {
    const result = await fetchJson<ChatSessionsResponse>("/api/chat/sessions")
    setSessions(result.sessions)
  }, [])

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
    const stored = readStoredSession()
    if (!stored.sessionFile && !stored.sessionId) return

    let cancelled = false
    const loadStoredSession = async () => {
      const result = await fetchJson<ChatSessionResponse>(
        `/api/chat/session?${metadataUrl(stored)}`
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
  }, [setMessagesSynced, setSessionMetadataSynced])

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

      const response = await fetch("/api/chat", {
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
      })

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
    [model, setMessagesSynced]
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
        const response = await fetch("/api/chat", {
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
        })

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
    [handleStreamEvent, mode, model, queueFollowUp, setMessagesSynced, status]
  )

  const stop = useCallback(() => {
    void fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionMetadataRef.current),
    }).catch(() => undefined)
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("ready")
    setActivityLabel(undefined)
  }, [])

  const startNewSession = useCallback(async () => {
    const result = await fetchJson<ChatSessionResponse>("/api/chat/new", {
      method: "POST",
    })
    setSessionMetadataSynced(result.session)
    setMessagesSynced([])
    setQueue({ steering: [], followUp: [] })
    setActivityLabel(undefined)
    setPlanLabel(undefined)
    await refreshSessions()
  }, [refreshSessions, setMessagesSynced, setSessionMetadataSynced])

  const resumeSession = useCallback(
    async (metadata: ChatSessionMetadata) => {
      const result = await fetchJson<ChatSessionResponse>("/api/chat/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      })
      setSessionMetadataSynced(result.session)
      setMessagesSynced(result.messages)
      setQueue({ steering: [], followUp: [] })
      setActivityLabel(
        result.sessionReset ? "Started a fresh Pi session" : undefined
      )
      setPlanLabel(undefined)
      await refreshSessions()
    },
    [refreshSessions, setMessagesSynced, setSessionMetadataSynced]
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
    startNewSession,
    status,
    stop,
  }
}

function labelForState(state: ChatStreamEvent["type"] | string) {
  switch (state) {
    case "agent_start":
      return "Agent running"
    case "turn_start":
      return "Starting turn"
    case "message_start":
      return "Receiving response"
    case "message_end":
      return "Response received"
    case "turn_end":
      return "Turn finished"
    case "agent_end":
      return undefined
    default:
      return undefined
  }
}

function queueLabel(queue: QueueState) {
  const count = queue.followUp.length + queue.steering.length
  if (count === 0) return undefined
  if (queue.followUp.length > 0) {
    return `${queue.followUp.length} follow-up queued`
  }
  return `${queue.steering.length} steering message queued`
}

function toModelOption(model: ChatModelInfo): ChatModelOption {
  return {
    id: model.key,
    name: model.name,
    provider: model.provider,
    modelId: model.id,
    thinkingLevel: model.defaultThinkingLevel,
  }
}

function toModelSelection(
  model: ChatModelOption | undefined
): ChatModelSelection | undefined {
  if (!model) return undefined
  return {
    provider: model.provider,
    id: model.modelId,
    thinkingLevel: model.thinkingLevel,
  }
}

function SessionControls({
  activeSessionId,
  onNewSession,
  onResumeSession,
  sessions,
}: {
  activeSessionId?: string
  onNewSession: () => void
  onResumeSession: (metadata: ChatSessionMetadata) => void
  sessions: Array<ChatSessionInfo>
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={onNewSession}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70"
        aria-label="New session"
        title="New session"
      >
        <Plus className="size-3.5" />
      </button>
      <div className="relative min-w-0">
        <History className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-foreground/35" />
        <select
          value={activeSessionId ?? ""}
          onChange={(event) => {
            const session = sessions.find(
              (item) => item.id === event.target.value
            )
            if (session) {
              onResumeSession({
                sessionFile: session.path,
                sessionId: session.id,
              })
            }
          }}
          className="h-7 max-w-[190px] rounded-[6px] border-0 bg-transparent pr-2 pl-6 text-[12px] leading-4 text-foreground/45 transition-colors outline-none hover:bg-foreground/6"
          aria-label="Resume session"
          title="Resume session"
        >
          <option value="">Session</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name || session.firstMessage || session.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function Chat() {
  const [models, setModels] = useState<Array<ChatModelOption>>([])
  const [modelKey, setModelKey] = useState<string | undefined>()
  const [mode, setMode] = useState<ChatMode>(() => readStoredMode())
  const [resources, setResources] = useState<ChatResourcesResponse | null>(null)
  const [resourcesError, setResourcesError] = useState<Error | null>(null)
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [resourceCanvasWidth, setResourceCanvasWidth] = useState(() =>
    readStoredResourceCanvasWidth()
  )

  useEffect(() => {
    let cancelled = false
    const loadModels = async () => {
      const result = await fetchJson<ChatModelsResponse>("/api/chat/models")
      if (cancelled) return
      const nextModels = result.models.map(toModelOption)
      setModels(nextModels)
      setModelKey(
        (current) => current ?? result.selectedModelKey ?? nextModels[0]?.id
      )
    }

    void loadModels()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshResources = useCallback(async () => {
    setResourcesLoading(true)
    setResourcesError(null)
    try {
      setResources(
        await fetchJson<ChatResourcesResponse>("/api/chat/resources")
      )
    } catch (err) {
      setResourcesError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setResourcesLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshResources()
  }, [refreshResources])

  const handleModeChange = useCallback((nextMode: string) => {
    const normalized: ChatMode = nextMode === "plan" ? "plan" : "agent"
    setMode(normalized)
    storeMode(normalized)
  }, [])

  const handleResourceCanvasResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = resourceCanvasWidth

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = clampResourceCanvasWidth(
          startWidth - (moveEvent.clientX - startX)
        )
        setResourceCanvasWidth(nextWidth)
        storeResourceCanvasWidth(nextWidth)
      }

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp, { once: true })
    },
    [resourceCanvasWidth]
  )

  const selectedModel = models.find((model) => model.id === modelKey)
  const modelSelection = useMemo(
    () => toModelSelection(selectedModel),
    [selectedModel]
  )
  const {
    activityLabel,
    error,
    messages,
    planLabel,
    queue,
    resumeSession,
    sendMessage,
    sessionMetadata,
    sessions,
    startNewSession,
    status,
    stop,
  } = usePiChat(modelSelection, mode)
  const infoDescription = queueLabel(queue) ?? activityLabel ?? planLabel

  const answerQuestion = useCallback(
    async ({
      toolCallId,
      answer,
    }: {
      toolCallId?: string
      answer: QuestionAnswer
    }) => {
      const result = await fetchJson<ChatQuestionAnswerResponse>(
        "/api/chat/question",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionFile: sessionMetadata.sessionFile,
            sessionId: sessionMetadata.sessionId,
            toolCallId,
            answer,
          }),
        }
      )

      if (result.mode) {
        handleModeChange(result.mode)
      }
      if (result.message) {
        await sendMessage({
          text: result.message,
          mode: result.mode,
          planAction: result.planAction,
        })
      }
    },
    [handleModeChange, sendMessage, sessionMetadata]
  )

  return (
    <div
      className="relative flex h-svh min-w-0 overflow-hidden"
      data-testid="chat-shell"
    >
      <div className="relative min-w-0 flex-1" data-testid="chat-column">
        <div className="fixed top-3 left-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-full border border-border/70 bg-background/85 px-1.5 py-1 shadow-sm backdrop-blur">
          <SessionControls
            activeSessionId={sessionMetadata.sessionId}
            sessions={sessions}
            onNewSession={() => void startNewSession()}
            onResumeSession={(metadata) => void resumeSession(metadata)}
          />
        </div>
        <ResourceLauncher
          onOpenChange={setResourcesOpen}
          open={resourcesOpen}
          resources={resources}
        />
        <ResourceMobilePanel
          error={resourcesError}
          loading={resourcesLoading}
          onOpenChange={setResourcesOpen}
          onRefresh={() => void refreshResources()}
          open={resourcesOpen}
          resources={resources}
        />
        <AgentChat
          messages={messages}
          status={status}
          onSend={(msg) => sendMessage({ text: msg.content })}
          onStop={stop}
          questionTool={{
            submitLabel: "Continue",
            allowSkip: true,
            onAnswer: ({ toolCallId, answer }) => {
              void answerQuestion({ toolCallId, answer }).catch(() => undefined)
            },
          }}
          error={error ?? undefined}
          emptyStatePosition="center"
          suggestions={[
            { id: "1", label: "What can you do?" },
            { id: "2", label: "Tell me about this project" },
          ]}
          slots={{
            InputBar: (props) => (
              <InputBar
                {...props}
                status={status === "streaming" ? "ready" : props.status}
                infoBar={
                  infoDescription
                    ? { description: infoDescription, position: "top" }
                    : undefined
                }
                leftActions={
                  <>
                    <ModeSelector
                      modes={CHAT_MODES}
                      value={mode}
                      onChange={handleModeChange}
                    />
                    <ModelPicker
                      models={models}
                      value={modelKey}
                      onChange={setModelKey}
                      placeholder="Model"
                    />
                  </>
                }
                rightActions={
                  <div className="flex items-center gap-1">
                    {(status === "streaming" || status === "submitted") && (
                      <SpiralLoader size={16} />
                    )}
                    {status === "streaming" && (
                      <button
                        type="button"
                        onClick={stop}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70"
                        aria-label="Stop"
                        title="Stop"
                      >
                        <Square className="size-3" />
                      </button>
                    )}
                  </div>
                }
              />
            ),
          }}
        />
      </div>
      <ResourceCanvas
        error={resourcesError}
        loading={resourcesLoading}
        onClose={() => setResourcesOpen(false)}
        onRefresh={() => void refreshResources()}
        onResizeStart={handleResourceCanvasResizeStart}
        open={resourcesOpen}
        resources={resources}
        width={resourceCanvasWidth}
      />
    </div>
  )
}
