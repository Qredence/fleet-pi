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
import { useCallback, useEffect, useMemo, useRef } from "react"
import type { CSSProperties, ReactNode } from "react"
import type {
  ChatSessionInfo,
  ChatSessionMetadata,
} from "@/lib/pi/chat-protocol"
import { ChatCommandPalette } from "@/components/chat-command-palette"
import { UiErrorBoundary } from "@/components/ui-error-boundary"
import { ChatRightPanels } from "@/components/chat-right-panels"
import { PI_TOOL_RENDERERS } from "@/components/pi/tool-renderers"
import { usePiChat } from "@/lib/pi/use-pi-chat"
import { CHAT_MODES, queueLabel } from "@/lib/pi/chat-helpers"
import {
  useChatModels,
  useChatResources,
  useWorkspaceTree,
} from "@/lib/pi/chat-queries"
import { collectCompletedResourceInstallToolCallIds } from "@/lib/pi/resource-install-refresh"
import { useChatShellState } from "@/lib/pi/use-chat-shell-state"
import {
  useActiveSessionLabel,
  useChatSuggestions,
} from "@/lib/pi/use-chat-view"

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
      className={`relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium whitespace-nowrap shadow-sm backdrop-blur transition-colors ${
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
          className="w-[6.5rem] justify-between sm:w-32 md:w-36 lg:w-[6.5rem] xl:w-40 2xl:w-64"
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
  rightPanelOpen,
  sessions,
}: {
  activeSessionId?: string
  activeSessionLabel: string
  onNewSession: () => void
  onResumeSession: (metadata: ChatSessionMetadata) => void
  rightPanelOpen: boolean
  sessions: Array<ChatSessionInfo>
}) {
  return (
    <div
      className={`pointer-events-none absolute top-3 left-3 z-50 ${
        rightPanelOpen
          ? "right-40 min-[960px]:right-3"
          : "right-40 min-[960px]:right-44"
      }`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="pointer-events-auto justify-self-start">
          <AccountMenu />
        </div>
        <div className="pointer-events-auto flex min-w-0 items-center gap-2 justify-self-center">
          <SessionMenu
            activeSessionId={activeSessionId}
            activeSessionLabel={activeSessionLabel}
            onResumeSession={onResumeSession}
            sessions={sessions}
          />
          <HeaderPillButton ariaLabel="New session" onClick={onNewSession}>
            <Plus className="size-3.5 shrink-0" />
            <span
              className={`hidden whitespace-nowrap ${
                rightPanelOpen ? "xl:inline" : "sm:inline"
              }`}
            >
              New session
            </span>
          </HeaderPillButton>
        </div>
        <div />
      </div>
    </div>
  )
}

function ChatWorkspaceShell() {
  const { data: modelsData } = useChatModels()
  const {
    commandPaletteOpen,
    handleModeChange,
    handleResourceCanvasResizeStart,
    handleThemePreferenceChange,
    initialSessionMetadata,
    mode,
    modelKey,
    modelSelection,
    models,
    persistSession,
    resourceCanvasWidth,
    rightPanel,
    setCommandPaletteOpen,
    setModelKey,
    setRightPanel,
    themePreference,
  } = useChatShellState(modelsData)

  const {
    data: resourcesData,
    isLoading: resourcesLoading,
    error: resourcesError,
    refetch: refetchResources,
  } = useChatResources()
  const shouldLoadWorkspaceTree =
    rightPanel === "resources" || rightPanel === "workspace"
  const {
    data: workspaceData,
    isLoading: workspaceLoading,
    error: workspaceError,
    refetch: refetchWorkspace,
  } = useWorkspaceTree({ enabled: shouldLoadWorkspaceTree })

  const resources = resourcesData ?? null
  const workspaceTree = workspaceData ?? null
  const handledResourceInstallToolCalls = useRef(new Set<string>())

  const refreshResources = useCallback(() => {
    void refetchResources()
  }, [refetchResources])

  const refreshWorkspace = useCallback(() => {
    void refetchWorkspace()
  }, [refetchWorkspace])

  const {
    activityLabel,
    answerQuestion,
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
    onModeChange: handleModeChange,
    persistSession,
  })

  useEffect(() => {
    const completedToolCallIds = collectCompletedResourceInstallToolCallIds(
      messages
    ).filter(
      (toolCallId) => !handledResourceInstallToolCalls.current.has(toolCallId)
    )

    if (completedToolCallIds.length === 0) return

    completedToolCallIds.forEach((toolCallId) => {
      handledResourceInstallToolCalls.current.add(toolCallId)
    })

    refreshResources()
    if (workspaceTree || shouldLoadWorkspaceTree) {
      refreshWorkspace()
    }
  }, [
    messages,
    refreshResources,
    refreshWorkspace,
    shouldLoadWorkspaceTree,
    workspaceTree,
  ])

  const infoDescription = queueLabel(queue) ?? activityLabel ?? planLabel
  const activeSessionLabel = useActiveSessionLabel({
    activeSessionId: sessionMetadata.sessionId,
    messages,
    sessions,
  })
  const suggestions = useChatSuggestions({
    messages,
    mode,
    resources,
    workspaceTree,
  })
  const shouldShowInputSuggestions = useMemo(() => {
    if (messages.length === 0) return true
    if (status === "streaming" || status === "submitted") return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== "assistant") return false

    return !hasPendingQuestion(lastMessage)
  }, [messages, status])
  const inputSuggestions = useMemo(
    () => ({
      items: shouldShowInputSuggestions ? suggestions : [],
      className: "!px-0 flex-col items-start gap-1.5",
      itemClassName:
        "h-auto justify-start rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-foreground/65 shadow-sm transition-colors hover:border-border hover:bg-foreground/6 hover:text-foreground",
    }),
    [shouldShowInputSuggestions, suggestions]
  )
  const agentChatStyle = useMemo(
    () =>
      ({
        "--an-input-focus-outline": "rgba(59, 130, 246, 0.32)",
      }) as CSSProperties,
    []
  )

  return (
    <>
      <ChatCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        mode={mode}
        onModeChange={handleModeChange}
        onNewSession={() => void startNewSession()}
        onStop={stop}
        onResumeSession={(session) =>
          void resumeSession({
            sessionFile: session.path,
            sessionId: session.id,
          })
        }
        onSetRightPanel={setRightPanel}
        onThemeChange={handleThemePreferenceChange}
        sessions={sessions}
        isStreaming={status === "streaming"}
        themePreference={themePreference}
      />
      <div
        className="relative flex h-svh min-w-0 overflow-hidden"
        data-testid="chat-shell"
      >
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          data-testid="chat-column"
        >
          <ChatHeader
            activeSessionId={sessionMetadata.sessionId}
            activeSessionLabel={activeSessionLabel}
            sessions={sessions}
            onNewSession={() => void startNewSession()}
            onResumeSession={(metadata) => void resumeSession(metadata)}
            rightPanelOpen={rightPanel !== null}
          />
          <UiErrorBoundary>
            <AgentChat
              messages={messages}
              status={status}
              onSend={(msg) => sendMessage({ text: msg.content })}
              onStop={stop}
              questionTool={{
                submitLabel: "Continue",
                allowSkip: true,
                onAnswer: ({ toolCallId, answer }) => {
                  void answerQuestion({ toolCallId, answer }).catch(
                    () => undefined
                  )
                },
              }}
              error={error ?? undefined}
              emptyStatePosition="default"
              suggestions={inputSuggestions}
              style={agentChatStyle}
              toolRenderers={PI_TOOL_RENDERERS}
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
          </UiErrorBoundary>
        </div>
        <UiErrorBoundary>
          <ChatRightPanels
            activityLabel={activityLabel}
            handleResourceCanvasResizeStart={handleResourceCanvasResizeStart}
            handleThemePreferenceChange={handleThemePreferenceChange}
            mode={mode}
            models={models}
            planLabel={planLabel}
            queue={queue}
            refreshResources={refreshResources}
            refreshWorkspace={refreshWorkspace}
            resourceCanvasWidth={resourceCanvasWidth}
            resources={resources}
            resourcesError={resourcesError}
            resourcesLoading={resourcesLoading}
            rightPanel={rightPanel}
            selectedModelKey={modelKey}
            setRightPanel={setRightPanel}
            status={status}
            themePreference={themePreference}
            workspaceError={workspaceError}
            workspaceLoading={workspaceLoading}
            workspaceTree={workspaceTree}
          />
        </UiErrorBoundary>
      </div>
    </>
  )
}

function hasPendingQuestion(
  message:
    | (typeof usePiChat extends (...args: Array<any>) => infer R
        ? R extends { messages: Array<infer M> }
          ? M
          : never
        : never)
    | undefined
) {
  if (!message || !Array.isArray(message.parts)) return false

  return message.parts.some((part) => {
    if (part.type !== "tool-Question") return false
    const output = part.output as
      | { answer?: unknown; answers?: Array<unknown> }
      | undefined
    return !output?.answer && (output?.answers?.length ?? 0) === 0
  })
}

function Chat() {
  return <ChatWorkspaceShell />
}
