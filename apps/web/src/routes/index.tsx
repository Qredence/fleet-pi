import { createFileRoute } from "@tanstack/react-router"
import {
  BookOpenText,
  ChevronDown,
  CircleUserRound,
  History,
  LogOut,
  Plus,
  Square,
} from "lucide-react"
import { AgentChat } from "@workspace/ui/components/agent-elements/agent-chat"
import { InputBar } from "@workspace/ui/components/agent-elements/input-bar"
import { ModeSelector } from "@workspace/ui/components/agent-elements/input/mode-selector"
import { ModelPicker } from "@workspace/ui/components/agent-elements/input/model-picker"
import { Popover } from "@workspace/ui/components/agent-elements/input/popover"
import { SpiralLoader } from "@workspace/ui/components/agent-elements/spiral-loader"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ChatMessage } from "@workspace/ui/components/agent-elements/chat-types"
import type { SuggestionItem } from "@workspace/ui/components/agent-elements/input/suggestions"
import type { QuestionAnswer } from "@workspace/ui/components/agent-elements/question/question-prompt"
import type { CSSProperties, ReactNode } from "react"
import type { RightPanel, ThemePreference } from "@/lib/canvas-utils"
import type {
  ChatMode,
  ChatModelsResponse,
  ChatQuestionAnswerResponse,
  ChatResourcesResponse,
  ChatSessionInfo,
  ChatSessionMetadata,
  WorkspaceTreeResponse,
} from "@/lib/pi/chat-protocol"
import type { ChatModelOption } from "@/lib/pi/chat-helpers"
import {
  applyThemePreference,
  clampResourceCanvasWidth,
  getResourceCanvasInitialWidth,
  readStoredResourceCanvasWidth,
  readStoredThemePreference,
  storeResourceCanvasWidth,
  storeThemePreference,
} from "@/lib/canvas-utils"
import { ChatRightPanels } from "@/components/chat-right-panels"
import {
  readStoredBrowserSession,
  readStoredMode,
  storeBrowserSession,
  storeMode,
} from "@/lib/pi/chat-storage"
import { usePiChat } from "@/lib/pi/use-pi-chat"
import { fetchJson } from "@/lib/pi/chat-fetch"
import {
  CHAT_MODES,
  queueLabel,
  toModelOption,
  toModelSelection,
} from "@/lib/pi/chat-helpers"

export const Route = createFileRoute("/")({ component: Chat })

function HeaderPillButton({
  active = false,
  ariaLabel,
  children,
  className,
  onClick,
}: {
  active?: boolean
  ariaLabel: string
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium shadow-sm backdrop-blur transition-colors ${
        active
          ? "border-border/70 bg-background text-foreground/75"
          : "border-border/70 bg-background/85 text-foreground/55 hover:bg-background hover:text-foreground/75"
      } ${className ?? ""}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {children}
    </button>
  )
}

function AccountMenu() {
  const items = [
    { id: "account", label: "Account", icon: CircleUserRound },
    { id: "docs", label: "Documentations", icon: BookOpenText },
    { id: "signout", label: "Sign out", icon: LogOut },
  ]

  return (
    <Popover
      side="bottom"
      align="start"
      trigger={
        <HeaderPillButton ariaLabel="Open account menu">
          <CircleUserRound className="size-3.5 shrink-0" />
          <ChevronDown className="size-3.5 shrink-0 text-foreground/35" />
        </HeaderPillButton>
      }
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] leading-4 text-an-foreground transition-colors hover:bg-foreground/6"
          >
            <Icon className="size-3.5 shrink-0 text-foreground/50" />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </Popover>
  )
}

function SessionMenu({
  activeSessionId,
  activeSessionLabel,
  onResumeSession,
  sessions,
}: {
  activeSessionId?: string
  activeSessionLabel: string
  onResumeSession: (metadata: ChatSessionMetadata) => void
  sessions: Array<ChatSessionInfo>
}) {
  return (
    <Popover
      side="bottom"
      align="center"
      className="w-[min(360px,calc(100vw-2rem))]"
      trigger={
        <HeaderPillButton
          ariaLabel="Open conversations"
          className="w-[min(360px,calc(100vw-8rem))] justify-between"
        >
          <div className="flex min-w-0 items-center gap-2">
            <History className="size-3 shrink-0 text-foreground/35" />
            <span className="min-w-0 truncate text-left">
              {activeSessionLabel}
            </span>
          </div>
          <ChevronDown className="size-3.5 shrink-0 text-foreground/35" />
        </HeaderPillButton>
      }
    >
      {sessions.length === 0 ? (
        <div className="px-2 py-2 text-[12px] text-foreground/45">
          No saved conversations yet.
        </div>
      ) : (
        sessions.map((session) => {
          const label =
            session.name || session.firstMessage || session.id.slice(0, 8)
          const active = session.id === activeSessionId
          return (
            <button
              key={session.id}
              type="button"
              onClick={() =>
                onResumeSession({
                  sessionFile: session.path,
                  sessionId: session.id,
                })
              }
              className={`flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] leading-4 transition-colors hover:bg-foreground/6 ${
                active
                  ? "bg-foreground/6 text-an-foreground"
                  : "text-an-foreground"
              }`}
            >
              <History className="size-3 shrink-0 text-foreground/45" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </button>
          )
        })
      )}
    </Popover>
  )
}

function ChatHeader({
  activeSessionId,
  activeSessionLabel,
  onNewSession,
  onResumeSession,
  sessions,
}: {
  activeSessionId?: string
  activeSessionLabel: string
  onNewSession: () => void
  onResumeSession: (metadata: ChatSessionMetadata) => void
  sessions: Array<ChatSessionInfo>
}) {
  return (
    <div className="pointer-events-none absolute top-3 right-40 left-3 z-50 lg:right-44">
      <div className="grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-3">
        <div className="pointer-events-auto justify-self-start">
          <AccountMenu />
        </div>
        <div className="pointer-events-auto min-w-0 justify-self-center">
          <SessionMenu
            activeSessionId={activeSessionId}
            activeSessionLabel={activeSessionLabel}
            onResumeSession={onResumeSession}
            sessions={sessions}
          />
        </div>
        <div className="pointer-events-auto justify-self-end">
          <HeaderPillButton ariaLabel="New session" onClick={onNewSession}>
            <Plus className="size-3.5 shrink-0" />
            <span>New session</span>
          </HeaderPillButton>
        </div>
      </div>
    </div>
  )
}

function ChatWorkspaceShell() {
  const [models, setModels] = useState<Array<ChatModelOption>>([])
  const [modelKey, setModelKey] = useState<string | undefined>()
  const [mode, setMode] = useState<ChatMode>(() => readStoredMode())
  const [resources, setResources] = useState<ChatResourcesResponse | null>(null)
  const [resourcesError, setResourcesError] = useState<Error | null>(null)
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    readStoredThemePreference()
  )
  const [resourceCanvasWidth, setResourceCanvasWidth] = useState(() =>
    readStoredResourceCanvasWidth()
  )
  const [workspaceTree, setWorkspaceTree] =
    useState<WorkspaceTreeResponse | null>(null)
  const [workspaceError, setWorkspaceError] = useState<Error | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)

  const persistSession = useCallback((metadata: ChatSessionMetadata) => {
    storeBrowserSession(metadata)
  }, [])

  const initialSessionMetadata = useMemo(() => readStoredBrowserSession(), [])

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

    void loadModels().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    applyThemePreference(themePreference)

    if (themePreference !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => applyThemePreference("system")
    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [themePreference])

  const handleThemePreferenceChange = useCallback(
    (preference: ThemePreference) => {
      setThemePreference(preference)
      storeThemePreference(preference)
      applyThemePreference(preference)
    },
    []
  )

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

  const refreshWorkspace = useCallback(async () => {
    setWorkspaceLoading(true)
    setWorkspaceError(null)
    try {
      setWorkspaceTree(
        await fetchJson<WorkspaceTreeResponse>("/api/workspace/tree")
      )
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setWorkspaceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (
      (rightPanel === "resources" || rightPanel === "workspace") &&
      !workspaceTree &&
      !workspaceLoading
    ) {
      void refreshWorkspace()
    }
  }, [refreshWorkspace, rightPanel, workspaceLoading, workspaceTree])

  useEffect(() => {
    if (!rightPanel) return
    const initialWidth = getResourceCanvasInitialWidth()
    setResourceCanvasWidth(initialWidth)
    storeResourceCanvasWidth(initialWidth)
  }, [rightPanel])

  useEffect(() => {
    if (!rightPanel) return

    const handleViewportResize = () => {
      setResourceCanvasWidth((currentWidth) => {
        const nextWidth = clampResourceCanvasWidth(currentWidth)
        storeResourceCanvasWidth(nextWidth)
        return nextWidth
      })
    }

    window.addEventListener("resize", handleViewportResize)
    return () => {
      window.removeEventListener("resize", handleViewportResize)
    }
  }, [rightPanel])

  const handleModeChange = useCallback((nextMode: string) => {
    const normalized: ChatMode = nextMode === "plan" ? "plan" : "agent"
    setMode(normalized)
    storeMode(normalized)
  }, [])

  const handleResourceCanvasResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
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
  } = usePiChat(modelSelection, mode, {
    initialSessionMetadata,
    persistSession,
  })

  const infoDescription = queueLabel(queue) ?? activityLabel ?? planLabel
  const activeSessionLabel = useMemo(
    () => getActiveSessionLabel(sessionMetadata.sessionId, sessions, messages),
    [messages, sessionMetadata.sessionId, sessions]
  )
  const suggestions = useMemo(
    () =>
      buildContextSuggestions({
        messages,
        mode,
        resources,
        workspaceTree,
      }),
    [messages, mode, resources, workspaceTree]
  )
  const agentChatStyle = useMemo(
    () =>
      ({
        "--an-input-focus-outline": "rgba(59, 130, 246, 0.32)",
      }) as CSSProperties,
    []
  )

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
        <ChatHeader
          activeSessionId={sessionMetadata.sessionId}
          activeSessionLabel={activeSessionLabel}
          sessions={sessions}
          onNewSession={() => void startNewSession()}
          onResumeSession={(metadata) => void resumeSession(metadata)}
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
          emptyStatePosition="default"
          suggestions={suggestions}
          style={agentChatStyle}
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
      <ChatRightPanels
        handleResourceCanvasResizeStart={handleResourceCanvasResizeStart}
        handleThemePreferenceChange={handleThemePreferenceChange}
        models={models}
        refreshResources={() => void refreshResources()}
        refreshWorkspace={() => void refreshWorkspace()}
        resourceCanvasWidth={resourceCanvasWidth}
        resources={resources}
        resourcesError={resourcesError}
        resourcesLoading={resourcesLoading}
        rightPanel={rightPanel}
        setRightPanel={setRightPanel}
        themePreference={themePreference}
        workspaceError={workspaceError}
        workspaceLoading={workspaceLoading}
        workspaceTree={workspaceTree}
      />
    </div>
  )
}

function Chat() {
  return <ChatWorkspaceShell />
}

function buildContextSuggestions({
  messages,
  mode,
  resources,
  workspaceTree,
}: {
  messages: Array<ChatMessage>
  mode: ChatMode
  resources: ChatResourcesResponse | null
  workspaceTree: WorkspaceTreeResponse | null
}): Array<SuggestionItem> {
  const hasAgentsFile = Boolean(
    resources?.agentsFiles.some((file) => file.name === "AGENTS.md")
  )
  const hasFrontendSkill =
    Boolean(
      resources?.skills.some((skill) =>
        `${skill.name} ${skill.description ?? ""}`
          .toLowerCase()
          .includes("frontend")
      )
    ) ||
    Boolean(
      workspaceTree?.nodes.some((node) =>
        JSON.stringify(node).toLowerCase().includes("frontend")
      )
    )
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")
  const lastUserText = extractMessageText(lastUserMessage).toLowerCase()

  if (mode === "plan") {
    return [
      suggestionItem("plan-codebase", "Plan a codebase walkthrough"),
      suggestionItem("plan-skill", 'Plan around the "frontend" skill'),
      suggestionItem("plan-tests", "Plan the next validation steps"),
    ]
  }

  if (!lastUserText) {
    return [
      suggestionItem("overview", "Summarize this project"),
      suggestionItem(
        "frontend",
        hasFrontendSkill
          ? 'Find a skill "frontend"'
          : "Explore available skills"
      ),
      suggestionItem(
        "docs",
        hasAgentsFile ? "Read AGENTS.md" : "Tell me about this project"
      ),
    ]
  }

  if (
    lastUserText.includes("what can you do") ||
    lastUserText.includes("help")
  ) {
    return [
      suggestionItem("frontend", 'Find a skill "frontend"'),
      suggestionItem(
        "agents",
        hasAgentsFile ? "Read AGENTS.md" : "Read the repo docs"
      ),
      suggestionItem("workspace", "Show workspace files"),
    ]
  }

  if (lastUserText.includes("frontend")) {
    return [
      suggestionItem("frontend-skill", 'Find a skill "frontend"'),
      suggestionItem("frontend-route", "Read apps/web/src/routes/index.tsx"),
      suggestionItem("frontend-workspace", "Show workspace files"),
    ]
  }

  if (lastUserText.includes("skill")) {
    return [
      suggestionItem("frontend-skill", 'Find a skill "frontend"'),
      suggestionItem("memory-skill", 'Find a skill "memory"'),
      suggestionItem(
        "skill-docs",
        hasAgentsFile ? "Read AGENTS.md" : "Show workspace files"
      ),
    ]
  }

  if (lastUserText.includes("read") || lastUserText.includes("doc")) {
    return [
      suggestionItem(
        "read-agents",
        hasAgentsFile ? "Read AGENTS.md" : "Read README.md"
      ),
      suggestionItem("project-summary", "Summarize the repo conventions"),
      suggestionItem("workspace-files", "Show workspace files"),
    ]
  }

  return [
    suggestionItem("continue", "Continue from the last task"),
    suggestionItem("workspace", "Show workspace files"),
    suggestionItem("frontend", 'Find a skill "frontend"'),
  ]
}

function suggestionItem(id: string, label: string): SuggestionItem {
  return { id, label, value: label }
}

function extractMessageText(message: ChatMessage | undefined) {
  if (!message) return ""

  return message.parts
    .filter(
      (
        part
      ): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
        part.type === "text" && typeof part.text === "string"
    )
    .map((part) => part.text)
    .join(" ")
}

function getActiveSessionLabel(
  activeSessionId: string | undefined,
  sessions: Array<ChatSessionInfo>,
  messages: Array<ChatMessage>
) {
  const activeSession = sessions.find(
    (session) => session.id === activeSessionId
  )
  if (activeSession) {
    return (
      activeSession.name ||
      activeSession.firstMessage ||
      activeSession.id.slice(0, 8)
    )
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")
  const label = extractMessageText(lastUserMessage).trim()
  return label || "Session"
}
