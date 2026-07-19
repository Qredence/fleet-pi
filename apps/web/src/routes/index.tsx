import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { FleetPiAgentChat } from "@workspace/hax-design/components/fleet-pi/chat/fleet-pi-agent-chat"
import { ChatCommandPalette } from "@workspace/hax-design/components/fleet-pi/chat-command-palette"
import { UiErrorBoundary } from "@workspace/hax-design/components/fleet-pi/ui-error-boundary"
import {
  AccountMenu,
  SessionControls,
} from "@workspace/hax-design/components/fleet-pi/layout/chat-header"
import { RightPanelShell } from "@workspace/hax-design/components/fleet-pi/layout/right-panel-shell"
import { RightPanelProvider } from "@workspace/hax-design/components/fleet-pi/layout/right-panel-context"
import { RightPanelLauncherFromContext } from "@workspace/hax-design/components/fleet-pi/pi/right-panel-launcher"
import { ChatWorkspaceLayout } from "@workspace/hax-design/components/fleet-pi/layout/chat-workspace-layout"
import { SettingsDialog } from "@workspace/hax-design/components/fleet-pi/pi/settings-dialog"
import {
  queueLabel,
  toModelOption,
} from "@workspace/hax-design/lib/pi/chat-helpers"
import type { SuggestionItem } from "@workspace/hax-design/components/agent-elements/input/suggestions"
import type { ChatPiSettingsUpdate } from "@workspace/pi-protocol/chat-protocol"
import type {
  LocalSlashAction,
  SettingsSlashTab,
} from "@/lib/pi/slash-commands"
import { assistantMessageHasPendingQuestion } from "@/lib/pi/question-pending"
import { usePiChat } from "@/lib/pi/use-pi-chat"
import { clearBrowserChatSessions } from "@/lib/pi/use-chat-storage"
import { signOut, useOptionalUser } from "@/lib/auth/use-auth"
import { identifyAnalyticsUser, resetAnalytics } from "@/lib/analytics/posthog"
import {
  useChatCommands,
  useChatModelCatalog,
  useChatModels,
  useChatProviders,
  useChatResources,
  useChatSettings,
  useDiscoverChatModels,
  useRemoveChatProvider,
  useUpdateChatProvider,
  useUpdateChatSettings,
  useWorkspaceTree,
} from "@/lib/pi/chat-queries"
import {
  buildSlashCommands,
  parseSlashInput,
  resolveLocalSlashAction,
} from "@/lib/pi/slash-commands"
import { collectCompletedResourceInstallToolCallIds } from "@/lib/pi/resource-install-refresh"
import { useChatShellState } from "@/lib/pi/use-chat-shell-state"
import { useRightPanelContextValue } from "@/lib/pi/use-right-panel-context-value"
import {
  useActiveSessionLabel,
  useChatSuggestions,
} from "@/lib/pi/use-chat-view"
import { usePendingQuestionBar } from "@/lib/pi/use-pending-question-bar"
import { loadWorkspaceFile } from "@/lib/workspace/client"

export const Route = createFileRoute("/")({ component: Chat })

function ChatWorkspaceShell() {
  const navigate = useNavigate()
  const user = useOptionalUser()
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    SettingsSlashTab | undefined
  >(undefined)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)

  useEffect(() => {
    if (user) identifyAnalyticsUser(user)
  }, [user])
  const { data: providersData, isLoading: isLoadingProviders } =
    useChatProviders()
  const { mutateAsync: onUpdateProvider, isPending: isUpdatingProvider } =
    useUpdateChatProvider()
  const { mutateAsync: onRemoveProvider, isPending: isRemovingProvider } =
    useRemoveChatProvider()
  const { data: modelsData } = useChatModels()
  const { data: modelCatalogData } = useChatModelCatalog({
    enabled: settingsDialogOpen,
  })
  const discoverModelsMutation = useDiscoverChatModels()
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
    openWorkspacePath,
    persistSession,
    resourceCanvasWidth,
    rightPanel,
    selectedWorkspacePath,
    setCommandPaletteOpen,
    setModelKey,
    setRightPanel,
    setSelectedWorkspacePath,
    themePreference,
  } = useChatShellState(modelsData)

  const {
    data: resourcesData,
    isLoading: resourcesLoading,
    error: resourcesError,
    refetch: refetchResources,
  } = useChatResources()
  const { data: commandsData } = useChatCommands()
  const {
    data: settingsData,
    isLoading: settingsLoading,
    error: settingsError,
  } = useChatSettings()
  const updateSettings = useUpdateChatSettings()
  const shouldLoadWorkspaceTree =
    rightPanel === "resources" ||
    rightPanel === "workspace" ||
    rightPanel === "artifacts"
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

  const saveSettings = useCallback(
    async (settings: ChatPiSettingsUpdate) => {
      const response = await updateSettings.mutateAsync({ settings })
      const nextModelKey =
        models.find(
          (model) =>
            model.provider === response.effective.defaultProvider &&
            model.modelId === response.effective.defaultModel
        )?.id ??
        (response.effective.defaultProvider && response.effective.defaultModel
          ? `${response.effective.defaultProvider}/${response.effective.defaultModel}`
          : undefined)
      if (nextModelKey) setModelKey(nextModelKey)
      return response
    },
    [models, setModelKey, updateSettings]
  )

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
    handledResourceInstallToolCalls.current.clear()
  }, [sessionMetadata.sessionId])

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
  const pendingQuestionBar = usePendingQuestionBar({
    messages,
    answerQuestion: ({ toolCallId, answer }) => {
      void answerQuestion({ toolCallId, answer }).catch(() => undefined)
    },
  })
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
    if (messages.length === 0) return false
    if (status === "streaming" || status === "submitted") return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== "assistant") return false

    return !assistantMessageHasPendingQuestion(lastMessage)
  }, [messages, status])
  const inputSuggestionItems = useMemo(
    () => (shouldShowInputSuggestions ? suggestions : []),
    [shouldShowInputSuggestions, suggestions]
  )
  const slashCommands = useMemo(
    () =>
      buildSlashCommands(
        resources,
        settingsData?.effective.enableSkillCommands ?? false,
        commandsData
      ),
    [commandsData, resources, settingsData]
  )

  const openSettings = useCallback((tab?: SettingsSlashTab) => {
    setSettingsInitialTab(tab)
    setSettingsDialogOpen(true)
  }, [])

  const applyLocalSlashAction = useCallback(
    (action: LocalSlashAction): boolean => {
      switch (action.type) {
        case "open-model-picker": {
          if (
            action.modelKey &&
            models.some((model) => model.id === action.modelKey)
          ) {
            setModelKey(action.modelKey)
            toast.success(`Model set to ${action.modelKey}`)
            return true
          }
          setModelPickerOpen(true)
          return true
        }
        case "open-settings":
          openSettings(action.tab)
          return true
        case "new-session":
          void startNewSession()
          return true
        case "show-session": {
          const sessionId = sessionMetadata.sessionId ?? "none"
          const sessionFile = sessionMetadata.sessionFile ?? "none"
          toast.message("Current session", {
            description: `${sessionId}\n${sessionFile}`,
          })
          return true
        }
        default: {
          const exhaustiveCheck: never = action
          void exhaustiveCheck
          return false
        }
      }
    },
    [
      models,
      openSettings,
      sessionMetadata.sessionFile,
      sessionMetadata.sessionId,
      setModelKey,
      startNewSession,
    ]
  )

  const handleSlashCommandSelect = useCallback(
    (item: SuggestionItem) => {
      const action = resolveLocalSlashAction(item.id)
      if (!action) return false
      return applyLocalSlashAction(action)
    },
    [applyLocalSlashAction]
  )

  const handleLocalSlashSubmit = useCallback(
    (message: string) => {
      const parsed = parseSlashInput(message)
      if (!parsed) return false
      const action = resolveLocalSlashAction(parsed.command, parsed.args)
      if (!action) return false
      return applyLocalSlashAction(action)
    },
    [applyLocalSlashAction]
  )

  const modelCatalog = useMemo(
    () => modelCatalogData?.models.map(toModelOption) ?? models,
    [modelCatalogData, models]
  )

  const onDiscoverModels = useCallback(
    async (providerId: string) => {
      const response = await discoverModelsMutation.mutateAsync(providerId)
      return response.models.map(toModelOption)
    },
    [discoverModelsMutation]
  )

  const rightPanelContextValue = useRightPanelContextValue({
    activityLabel,
    handleThemePreferenceChange,
    isLoadingProviders,
    isUpdatingProvider: isUpdatingProvider || isRemovingProvider,
    loadWorkspaceFile,
    mode,
    modelKey,
    models,
    modelCatalog,
    onDiscoverModels,
    onRemoveProvider,
    onUpdateProvider,
    openWorkspacePath,
    planLabel,
    providers: providersData?.providers ?? [],
    queue,
    refreshResources,
    refreshWorkspace,
    resources,
    resourcesError,
    resourcesLoading,
    rightPanel,
    saveSettings,
    selectedWorkspacePath,
    setRightPanel,
    setSelectedWorkspacePath,
    settings: settingsData ?? null,
    settingsError,
    settingsLoading: settingsLoading || updateSettings.isPending,
    status,
    themePreference,
    workspaceError,
    workspaceLoading,
    workspaceTree,
  })

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
      <RightPanelProvider value={rightPanelContextValue}>
        <ChatWorkspaceLayout
          headerLeft={
            <AccountMenu
              user={user}
              onSignOut={async () => {
                clearBrowserChatSessions()
                await signOut()
                resetAnalytics()
                void navigate({ to: "/" })
              }}
              onSignIn={() => void navigate({ to: "/login" })}
              onOpenSettings={() => openSettings()}
            />
          }
          headerCenter={
            <SessionControls
              activeSessionId={sessionMetadata.sessionId}
              activeSessionLabel={activeSessionLabel}
              sessions={sessions}
              onNewSession={() => void startNewSession()}
              onResumeSession={(metadata) => void resumeSession(metadata)}
            />
          }
          headerRight={<RightPanelLauncherFromContext />}
          panel={
            <UiErrorBoundary>
              <RightPanelShell
                handleResourceCanvasResizeStart={
                  handleResourceCanvasResizeStart
                }
                resourceCanvasWidth={resourceCanvasWidth}
              />
            </UiErrorBoundary>
          }
        >
          <UiErrorBoundary>
            <FleetPiAgentChat
              messages={messages}
              status={status}
              onSend={(msg) => sendMessage({ text: msg.content })}
              onOpenUIAction={(message) => sendMessage({ text: message })}
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
              suppressQuestionTool={!!pendingQuestionBar}
              error={error ?? undefined}
              emptyStatePosition="default"
              suggestions={inputSuggestionItems}
              inputBar={{
                mode,
                modelKey,
                models,
                infoDescription,
                slashCommands,
                questionBar: pendingQuestionBar,
                onModeChange: handleModeChange,
                onModelChange: setModelKey,
                onSlashCommandSelect: handleSlashCommandSelect,
                onLocalSlashSubmit: handleLocalSlashSubmit,
                modelPickerOpen,
                onModelPickerOpenChange: setModelPickerOpen,
              }}
            />
          </UiErrorBoundary>
        </ChatWorkspaceLayout>
        <SettingsDialog
          open={settingsDialogOpen}
          onOpenChange={(open) => {
            setSettingsDialogOpen(open)
            if (!open) setSettingsInitialTab(undefined)
          }}
          initialTab={settingsInitialTab}
        />
      </RightPanelProvider>
    </>
  )
}

function Chat() {
  return <ChatWorkspaceShell />
}
