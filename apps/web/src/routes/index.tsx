import { createFileRoute } from "@tanstack/react-router"
import {
  ExternalLink,
  FolderOpen,
  HardDrive,
  History,
  Plus,
  Square,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AgentChat } from "@workspace/ui/components/agent-elements/agent-chat"
import { InputBar } from "@workspace/ui/components/agent-elements/input-bar"
import { ModeSelector } from "@workspace/ui/components/agent-elements/input/mode-selector"
import { ModelPicker } from "@workspace/ui/components/agent-elements/input/model-picker"
import { SpiralLoader } from "@workspace/ui/components/agent-elements/spiral-loader"
import type { QuestionAnswer } from "@workspace/ui/components/agent-elements/question/question-prompt"
import type { DesktopContext, DesktopProjectSummary } from "@/lib/desktop/types"
import type {
  ResourceCanvasTab,
  ThemePreference,
} from "@/components/pi/resource-library"
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
import { withDesktopHeaders } from "@/lib/desktop/client"
import {
  ResourceCanvas,
  ResourceLauncher,
  ResourceMobilePanel,
  applyThemePreference,
  clampResourceCanvasWidth,
  getResourceCanvasInitialWidth,
  readStoredResourceCanvasWidth,
  readStoredThemePreference,
  storeResourceCanvasWidth,
  storeThemePreference,
} from "@/components/pi/resource-library"
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
  displayNameFromPath,
  queueLabel,
  toModelOption,
  toModelSelection,
} from "@/lib/pi/chat-helpers"

export const Route = createFileRoute("/")({ component: Chat })

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

function DesktopProjectControls({
  activeProjectRoot,
  activeWorkspaceRoot,
  onOpenProject,
  onOpenRecentProject,
  onRevealProject,
  onRevealWorkspace,
  recentProjects,
}: {
  activeProjectRoot?: string
  activeWorkspaceRoot?: string
  onOpenProject: () => void
  onOpenRecentProject: (projectRoot: string) => void
  onRevealProject: () => void
  onRevealWorkspace: () => void
  recentProjects: Array<DesktopProjectSummary>
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={onOpenProject}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-foreground/7 text-foreground/70 transition-colors hover:bg-foreground/10"
        aria-label="Open project"
        title="Open project"
      >
        <FolderOpen className="size-4" />
      </button>
      <div className="max-w-[280px] min-w-0">
        <div className="truncate text-[12px] font-medium text-foreground/78">
          {displayNameFromPath(activeProjectRoot)}
        </div>
        <div className="truncate text-[11px] text-foreground/42">
          {activeWorkspaceRoot}
        </div>
      </div>
      <div className="relative min-w-0">
        <History className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-foreground/35" />
        <select
          value={activeProjectRoot ?? ""}
          onChange={(event) => {
            const nextRoot = event.target.value
            if (nextRoot) onOpenRecentProject(nextRoot)
          }}
          className="h-7 max-w-[220px] rounded-[6px] border-0 bg-transparent pr-2 pl-6 text-[12px] leading-4 text-foreground/45 transition-colors outline-none hover:bg-foreground/6"
          aria-label="Recent projects"
          title="Recent projects"
        >
          <option value={activeProjectRoot ?? ""}>Recent projects</option>
          {recentProjects.map((project) => (
            <option key={project.workspaceId} value={project.projectRoot}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={onRevealProject}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70"
        aria-label="Reveal project"
        title="Reveal project"
      >
        <ExternalLink className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onRevealWorkspace}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70"
        aria-label="Reveal workspace"
        title="Reveal workspace"
      >
        <HardDrive className="size-3.5" />
      </button>
    </div>
  )
}

function DesktopEmptyState({
  onClearRecentProjects,
  onOpenProject,
  onOpenRecentProject,
  recentProjects,
}: {
  onClearRecentProjects: () => void
  onOpenProject: () => void
  onOpenRecentProject: (projectRoot: string) => void
  recentProjects: Array<DesktopProjectSummary>
}) {
  return (
    <div className="relative flex h-svh min-w-0 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(78,124,245,0.08),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,1))] px-6 dark:bg-[radial-gradient(circle_at_top,_rgba(78,124,245,0.16),_transparent_42%),linear-gradient(180deg,rgba(7,10,16,0.98),rgba(7,10,16,1))]">
      <div className="w-full max-w-3xl">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium tracking-[0.12em] text-foreground/42 uppercase backdrop-blur">
            <HardDrive className="size-3" />
            <span>Desktop Workspace</span>
          </div>
          <h1 className="max-w-xl text-3xl font-semibold tracking-normal text-foreground/88 sm:text-4xl">
            Open a local project to start a desktop agent workspace
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-foreground/58">
            Fleet Pi will use an existing project folder, create or reuse
            `agent-workspace/` inside it, and keep Electron-only sessions in app
            storage instead of the repo.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenProject}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-foreground px-4 text-[13px] font-medium text-background transition-transform hover:-translate-y-px"
            >
              <FolderOpen className="size-4" />
              <span>Open project folder</span>
            </button>
            {recentProjects.length > 0 && (
              <button
                type="button"
                onClick={onClearRecentProjects}
                className="inline-flex h-11 items-center rounded-[10px] border border-border/70 px-4 text-[13px] font-medium text-foreground/62 transition-colors hover:bg-foreground/5"
              >
                Clear recent projects
              </button>
            )}
          </div>
        </div>

        {recentProjects.length > 0 && (
          <div className="mt-10 grid gap-2 sm:grid-cols-2">
            {recentProjects.map((project) => (
              <button
                key={project.workspaceId}
                type="button"
                onClick={() => onOpenRecentProject(project.projectRoot)}
                className="flex min-w-0 items-center gap-3 rounded-[10px] border border-border/70 bg-background/72 px-4 py-3 text-left shadow-sm backdrop-blur transition-colors hover:bg-background/92"
              >
                <History className="size-4 shrink-0 text-foreground/38" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground/78">
                    {project.name}
                  </div>
                  <div className="truncate text-[11px] text-foreground/44">
                    {project.projectRoot}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChatWorkspaceShell({
  desktopContext,
  newSessionSignal,
}: {
  desktopContext?: DesktopContext
  newSessionSignal: number
}) {
  const [models, setModels] = useState<Array<ChatModelOption>>([])
  const [modelKey, setModelKey] = useState<string | undefined>()
  const [mode, setMode] = useState<ChatMode>(() => readStoredMode())
  const [resources, setResources] = useState<ChatResourcesResponse | null>(null)
  const [resourcesError, setResourcesError] = useState<Error | null>(null)
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [resourceCanvasTab, setResourceCanvasTab] =
    useState<ResourceCanvasTab>("resources")
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

  const persistSession = useCallback(
    (metadata: ChatSessionMetadata) => {
      if (desktopContext?.isDesktop) {
        void window.fleetPiDesktop?.setActiveSession(metadata)
        return
      }
      storeBrowserSession(metadata)
    },
    [desktopContext]
  )

  const initialSessionMetadata = useMemo(
    () =>
      desktopContext?.isDesktop
        ? (desktopContext.activeSession ?? {})
        : readStoredBrowserSession(),
    [
      desktopContext?.activeSession,
      desktopContext?.isDesktop,
      desktopContext?.workspaceId,
    ]
  )

  const desktopRequestInit = useMemo(
    () => withDesktopHeaders(undefined, desktopContext),
    [desktopContext]
  )

  useEffect(() => {
    let cancelled = false
    const loadModels = async () => {
      const result = await fetchJson<ChatModelsResponse>(
        "/api/chat/models",
        desktopContext
      )
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
  }, [desktopContext])

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
        await fetchJson<ChatResourcesResponse>(
          "/api/chat/resources",
          desktopContext
        )
      )
    } catch (err) {
      setResourcesError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setResourcesLoading(false)
    }
  }, [desktopContext])

  useEffect(() => {
    void refreshResources()
  }, [refreshResources])

  const refreshWorkspace = useCallback(async () => {
    setWorkspaceLoading(true)
    setWorkspaceError(null)
    try {
      setWorkspaceTree(
        await fetchJson<WorkspaceTreeResponse>(
          "/api/workspace/tree",
          desktopContext
        )
      )
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setWorkspaceLoading(false)
    }
  }, [desktopContext])

  useEffect(() => {
    if (resourcesOpen && !workspaceTree && !workspaceLoading) {
      void refreshWorkspace()
    }
  }, [refreshWorkspace, resourcesOpen, workspaceLoading, workspaceTree])

  useEffect(() => {
    if (!resourcesOpen) return
    const initialWidth = getResourceCanvasInitialWidth()
    setResourceCanvasWidth(initialWidth)
    storeResourceCanvasWidth(initialWidth)
  }, [resourcesOpen])

  useEffect(() => {
    if (!resourcesOpen) return

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
  }, [resourcesOpen])

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
    setError,
    startNewSession,
    status,
    stop,
  } = usePiChat(modelSelection, mode, {
    desktopContext,
    initialSessionMetadata,
    persistSession,
  })

  useEffect(() => {
    if (!desktopContext?.isDesktop) return
    if (
      desktopContext.activeSession?.sessionId ||
      desktopContext.activeSession?.sessionFile
    ) {
      return
    }
    void startNewSession().catch((err) => {
      setError(err instanceof Error ? err : new Error(String(err)))
    })
  }, [desktopContext, setError, startNewSession])

  const handledNewSessionSignalRef = useRef(newSessionSignal)
  useEffect(() => {
    if (!desktopContext?.isDesktop) return
    if (newSessionSignal === handledNewSessionSignalRef.current) return
    handledNewSessionSignalRef.current = newSessionSignal
    void startNewSession().catch(() => undefined)
  }, [desktopContext, newSessionSignal, startNewSession])

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
        desktopContext,
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
    [desktopContext, handleModeChange, sendMessage, sessionMetadata]
  )

  const openProject = useCallback(() => {
    void window.fleetPiDesktop?.pickProjectDirectory()
  }, [])

  const openRecentProject = useCallback((projectRoot: string) => {
    void window.fleetPiDesktop?.openRecentProject(projectRoot)
  }, [])

  const revealProject = useCallback(() => {
    void window.fleetPiDesktop?.revealPath("project")
  }, [])

  const revealWorkspace = useCallback(() => {
    void window.fleetPiDesktop?.revealPath("workspace")
  }, [])

  return (
    <div
      className="relative flex h-svh min-w-0 overflow-hidden"
      data-testid="chat-shell"
    >
      <div className="relative min-w-0 flex-1" data-testid="chat-column">
        <div className="fixed top-3 left-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-border/70 bg-background/85 px-1.5 py-1 shadow-sm backdrop-blur">
          {desktopContext?.isDesktop && (
            <DesktopProjectControls
              activeProjectRoot={desktopContext.activeProjectRoot}
              activeWorkspaceRoot={desktopContext.activeWorkspaceRoot}
              onOpenProject={openProject}
              onOpenRecentProject={openRecentProject}
              onRevealProject={revealProject}
              onRevealWorkspace={revealWorkspace}
              recentProjects={desktopContext.recentProjects}
            />
          )}
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
          workspace={workspaceTree}
        />
        <ResourceMobilePanel
          activeTab={resourceCanvasTab}
          error={resourcesError}
          loading={resourcesLoading}
          models={models}
          onOpenChange={setResourcesOpen}
          onRefresh={() => void refreshResources()}
          onRefreshWorkspace={() => void refreshWorkspace()}
          onTabChange={setResourceCanvasTab}
          onThemePreferenceChange={handleThemePreferenceChange}
          open={resourcesOpen}
          requestInit={desktopRequestInit}
          resources={resources}
          themePreference={themePreference}
          workspace={workspaceTree}
          workspaceError={workspaceError}
          workspaceLoading={workspaceLoading}
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
        activeTab={resourceCanvasTab}
        error={resourcesError}
        loading={resourcesLoading}
        models={models}
        onClose={() => setResourcesOpen(false)}
        onRefresh={() => void refreshResources()}
        onRefreshWorkspace={() => void refreshWorkspace()}
        onResizeStart={handleResourceCanvasResizeStart}
        onTabChange={setResourceCanvasTab}
        onThemePreferenceChange={handleThemePreferenceChange}
        open={resourcesOpen}
        requestInit={desktopRequestInit}
        resources={resources}
        themePreference={themePreference}
        width={resourceCanvasWidth}
        workspace={workspaceTree}
        workspaceError={workspaceError}
        workspaceLoading={workspaceLoading}
      />
    </div>
  )
}

function Chat() {
  const [desktopContext, setDesktopContext] = useState<DesktopContext | null>(
    null
  )
  const [desktopLoading, setDesktopLoading] = useState(true)
  const [newSessionSignal, setNewSessionSignal] = useState(0)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    async function loadDesktopContext() {
      if (typeof window === "undefined" || !window.fleetPiDesktop) {
        if (!cancelled) {
          setDesktopContext({ isDesktop: false, recentProjects: [] })
          setDesktopLoading(false)
        }
        return
      }

      const context = await window.fleetPiDesktop.getDesktopContext()
      if (cancelled) return
      setDesktopContext(context)
      setDesktopLoading(false)
      unsubscribe = window.fleetPiDesktop.onEvent((event) => {
        if (event.type === "context-changed") {
          setDesktopContext(event.context)
          return
        }
        setNewSessionSignal((current) => current + 1)
      })
    }

    void loadDesktopContext().catch(() => {
      if (!cancelled) {
        setDesktopContext({ isDesktop: false, recentProjects: [] })
        setDesktopLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const openProject = useCallback(() => {
    void window.fleetPiDesktop?.pickProjectDirectory()
  }, [])

  const openRecentProject = useCallback((projectRoot: string) => {
    void window.fleetPiDesktop?.openRecentProject(projectRoot)
  }, [])

  const clearRecentProjects = useCallback(() => {
    void window.fleetPiDesktop?.clearRecentProjects()
  }, [])

  if (desktopLoading || !desktopContext) {
    return (
      <div className="flex h-svh min-w-0 items-center justify-center bg-background">
        <div className="text-[13px] text-foreground/45">
          Loading workspace context...
        </div>
      </div>
    )
  }

  if (desktopContext.isDesktop && !desktopContext.activeProjectRoot) {
    return (
      <DesktopEmptyState
        onClearRecentProjects={clearRecentProjects}
        onOpenProject={openProject}
        onOpenRecentProject={openRecentProject}
        recentProjects={desktopContext.recentProjects}
      />
    )
  }

  return (
    <ChatWorkspaceShell
      key={
        desktopContext.isDesktop
          ? (desktopContext.workspaceId ??
            desktopContext.activeProjectRoot ??
            "desktop")
          : "browser"
      }
      desktopContext={desktopContext.isDesktop ? desktopContext : undefined}
      newSessionSignal={newSessionSignal}
    />
  )
}
