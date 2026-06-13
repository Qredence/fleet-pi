import { Folder, Library, Package, Settings } from "lucide-react"
import { ArtifactsPanelContent } from "../pi/artifacts-panel"
import { ConfigurationsPanelContent } from "../pi/config-panel/index"
import { ResourcesPanelContent } from "../pi/resources-panel"
import { WorkspacePanelContent } from "../pi/workspace-panel"
import type { ElementType, ReactNode } from "react"
import type { ChatStatus } from "../../agent-elements/chat-types"
import type { RightPanel, ThemePreference } from "../../../lib/canvas-utils"
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
} from "../../../lib/pi/chat-protocol"
import type { ChatModelOption } from "../../../lib/pi/chat-helpers"

export type ActiveRightPanel = Exclude<RightPanel, null>

export type RightPanelContentProps = {
  activityLabel?: string
  isLoadingProviders?: boolean
  isUpdatingProvider?: boolean
  mode: ChatMode
  models: Array<ChatModelOption>
  onThemePreferenceChange: (preference: ThemePreference) => void
  onUpdateProvider?: (
    request: ChatProviderUpdateRequest
  ) => Promise<ChatProviderUpdateResponse>
  planLabel?: string
  providers?: Array<ChatProviderInfo>
  queue: QueueState
  refreshResources: () => void
  refreshWorkspace: () => void
  resources: ChatResourcesResponse | null
  resourcesError: Error | null
  resourcesLoading: boolean
  saveSettings: (settings: ChatPiSettingsUpdate) => Promise<void>
  selectedModelKey?: string
  settings: ChatSettingsResponse | null
  settingsError: Error | null
  settingsLoading: boolean
  status: ChatStatus
  themePreference: ThemePreference
  workspaceError: Error | null
  workspaceLoading: boolean
  workspaceTree: WorkspaceTreeResponse | null
  loadWorkspaceFile: (path: string) => Promise<WorkspaceFileResponse>
  openWorkspacePath: (rawPath: string) => void
  selectedWorkspacePath: string | null
  setSelectedWorkspacePath: (path: string | null) => void
}

type RightPanelDefinition = {
  title: string
  icon: ElementType
  dataTestid: string
  mobileDataTestid: string
  getLoading: (props: RightPanelContentProps) => boolean
  getOnRefresh: (props: RightPanelContentProps) => (() => void) | undefined
  render: (props: RightPanelContentProps) => ReactNode
}

export const RIGHT_PANEL_REGISTRY: Record<
  ActiveRightPanel,
  RightPanelDefinition
> = {
  resources: {
    title: "Pi Resources",
    icon: Library,
    dataTestid: "pi-resources-canvas",
    mobileDataTestid: "pi-resources-mobile-panel",
    getLoading: (props) => props.resourcesLoading,
    getOnRefresh: (props) => props.refreshResources,
    render: (props) => (
      <ResourcesPanelContent
        error={props.resourcesError}
        loading={props.resourcesLoading}
        resources={props.resources}
        workspace={props.workspaceTree}
      />
    ),
  },
  workspace: {
    title: "Workspace",
    icon: Folder,
    dataTestid: "pi-workspace-canvas",
    mobileDataTestid: "pi-workspace-mobile-panel",
    getLoading: (props) => props.workspaceLoading,
    getOnRefresh: (props) => props.refreshWorkspace,
    render: (props) => (
      <WorkspacePanelContent
        error={props.workspaceError}
        loadWorkspaceFile={props.loadWorkspaceFile}
        loading={props.workspaceLoading}
        onSelectedPathChange={props.setSelectedWorkspacePath}
        selectedPath={props.selectedWorkspacePath}
        workspace={props.workspaceTree}
      />
    ),
  },
  artifacts: {
    title: "Artifacts",
    icon: Package,
    dataTestid: "pi-artifacts-canvas",
    mobileDataTestid: "pi-artifacts-mobile-panel",
    getLoading: (props) => props.workspaceLoading,
    getOnRefresh: (props) => props.refreshWorkspace,
    render: (props) => (
      <ArtifactsPanelContent
        error={props.workspaceError}
        loadWorkspaceFile={props.loadWorkspaceFile}
        loading={props.workspaceLoading}
        onSelectedPathChange={props.setSelectedWorkspacePath}
        selectedPath={props.selectedWorkspacePath}
        workspace={props.workspaceTree}
      />
    ),
  },
  configurations: {
    title: "Configurations",
    icon: Settings,
    dataTestid: "pi-config-canvas",
    mobileDataTestid: "pi-config-mobile-panel",
    getLoading: () => false,
    getOnRefresh: () => undefined,
    render: (props) => (
      <ConfigurationsPanelContent
        activityLabel={props.activityLabel}
        isLoadingProviders={props.isLoadingProviders}
        isUpdatingProvider={props.isUpdatingProvider}
        mode={props.mode}
        models={props.models}
        onThemePreferenceChange={props.onThemePreferenceChange}
        onUpdateProvider={props.onUpdateProvider}
        planLabel={props.planLabel}
        providers={props.providers}
        queue={props.queue}
        resources={props.resources}
        saveSettings={props.saveSettings}
        selectedModelKey={props.selectedModelKey}
        settings={props.settings}
        settingsError={props.settingsError}
        settingsLoading={props.settingsLoading}
        status={props.status}
        themePreference={props.themePreference}
      />
    ),
  },
}

export function getRightPanelDefinition(panel: ActiveRightPanel) {
  return RIGHT_PANEL_REGISTRY[panel]
}
