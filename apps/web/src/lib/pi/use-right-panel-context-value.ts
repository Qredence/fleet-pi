import { useMemo } from "react"
import type { RightPanelContextValue } from "@workspace/hax-design/components/fleet-pi/layout/right-panel-context"
import type {
  ChatMode,
  ChatPiSettingsUpdate,
  ChatProviderInfo,
  ChatProviderUpdateRequest,
  ChatProviderUpdateResponse,
  ChatResourcesResponse,
  ChatSettingsResponse,
  QueueState,
  WorkspaceFileResponse,
  WorkspaceTreeResponse,
} from "@workspace/hax-design/lib/pi/chat-protocol"
import type { ChatModelOption } from "@workspace/hax-design/lib/pi/chat-helpers"
import type {
  RightPanel,
  ThemePreference,
} from "@workspace/hax-design/lib/canvas-utils"
import type { ChatStatus } from "@workspace/hax-design/components/agent-elements/chat-types"

type UseRightPanelContextValueArgs = {
  activityLabel?: string
  handleThemePreferenceChange: (preference: ThemePreference) => void
  isLoadingProviders?: boolean
  isUpdatingProvider?: boolean
  loadWorkspaceFile: (path: string) => Promise<WorkspaceFileResponse>
  mode: ChatMode
  modelKey?: string
  models: Array<ChatModelOption>
  onUpdateProvider?: (
    request: ChatProviderUpdateRequest
  ) => Promise<ChatProviderUpdateResponse>
  openWorkspacePath: (rawPath: string) => void
  planLabel?: string
  providers?: Array<ChatProviderInfo>
  queue: QueueState
  refreshResources: () => void
  refreshWorkspace: () => void
  resources: ChatResourcesResponse | null
  resourcesError: Error | null
  resourcesLoading: boolean
  rightPanel: RightPanel
  saveSettings: (settings: ChatPiSettingsUpdate) => Promise<void>
  selectedWorkspacePath: string | null
  setRightPanel: (panel: RightPanel) => void
  setSelectedWorkspacePath: (path: string | null) => void
  settings: ChatSettingsResponse | null
  settingsError: Error | null
  settingsLoading: boolean
  status: ChatStatus
  themePreference: ThemePreference
  workspaceError: Error | null
  workspaceLoading: boolean
  workspaceTree: WorkspaceTreeResponse | null
}

export function useRightPanelContextValue({
  activityLabel,
  handleThemePreferenceChange,
  isLoadingProviders,
  isUpdatingProvider,
  loadWorkspaceFile,
  mode,
  modelKey,
  models,
  onUpdateProvider,
  openWorkspacePath,
  planLabel,
  providers,
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
  settings,
  settingsError,
  settingsLoading,
  status,
  themePreference,
  workspaceError,
  workspaceLoading,
  workspaceTree,
}: UseRightPanelContextValueArgs): RightPanelContextValue {
  return useMemo(
    () => ({
      activityLabel,
      isLoadingProviders,
      isUpdatingProvider,
      loadWorkspaceFile,
      mode,
      models,
      onThemePreferenceChange: handleThemePreferenceChange,
      onUpdateProvider,
      openWorkspacePath,
      planLabel,
      providers,
      queue,
      refreshResources,
      refreshWorkspace,
      resources,
      resourcesError,
      resourcesLoading,
      rightPanel,
      saveSettings,
      selectedModelKey: modelKey,
      selectedWorkspacePath,
      setRightPanel,
      setSelectedWorkspacePath,
      settings,
      settingsError,
      settingsLoading,
      status,
      themePreference,
      workspaceError,
      workspaceLoading,
      workspaceTree,
    }),
    [
      activityLabel,
      handleThemePreferenceChange,
      isLoadingProviders,
      isUpdatingProvider,
      loadWorkspaceFile,
      mode,
      modelKey,
      models,
      onUpdateProvider,
      openWorkspacePath,
      planLabel,
      providers,
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
      settings,
      settingsError,
      settingsLoading,
      status,
      themePreference,
      workspaceError,
      workspaceLoading,
      workspaceTree,
    ]
  )
}
