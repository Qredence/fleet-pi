import { useMemo } from "react"
import { Folder, Library, Settings } from "lucide-react"
import { ConfigurationsPanelContent } from "./pi/config-panel"
import { MobilePanel, RightPanelLauncher } from "./pi/right-panel-launcher"
import { ResizableCanvas } from "./pi/resizable-canvas"
import { ResourcesPanelContent } from "./pi/resources-panel"
import { WorkspacePanelContent } from "./pi/workspace-panel"
import type { PointerEvent as ReactPointerEvent } from "react"
import type { ChatStatus } from "@workspace/ui/components/agent-elements/chat-types"
import type { RightPanel, ThemePreference } from "@/lib/canvas-utils"
import type {
  ChatMode,
  ChatPiSettingsUpdate,
  ChatResourcesResponse,
  ChatSettingsResponse,
  WorkspaceTreeResponse,
} from "@/lib/pi/chat-protocol"
import type { QueueState } from "@/lib/pi/chat-fetch"
import type { ChatModelOption } from "@/lib/pi/chat-helpers"

export function ChatRightPanels({
  activityLabel,
  handleResourceCanvasResizeStart,
  handleThemePreferenceChange,
  mode,
  models,
  planLabel,
  queue,
  refreshResources,
  refreshWorkspace,
  resourceCanvasWidth,
  resources,
  resourcesError,
  resourcesLoading,
  rightPanel,
  saveSettings,
  selectedModelKey,
  setRightPanel,
  settings,
  settingsError,
  settingsLoading,
  status,
  themePreference,
  workspaceError,
  workspaceLoading,
  workspaceTree,
}: {
  activityLabel?: string
  handleResourceCanvasResizeStart: (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void
  handleThemePreferenceChange: (preference: ThemePreference) => void
  mode: ChatMode
  models: Array<ChatModelOption>
  planLabel?: string
  queue: QueueState
  refreshResources: () => void
  refreshWorkspace: () => void
  resourceCanvasWidth: number
  resources: ChatResourcesResponse | null
  resourcesError: Error | null
  resourcesLoading: boolean
  rightPanel: RightPanel
  saveSettings: (settings: ChatPiSettingsUpdate) => Promise<void>
  selectedModelKey?: string
  setRightPanel: (panel: RightPanel) => void
  settings: ChatSettingsResponse | null
  settingsError: Error | null
  settingsLoading: boolean
  status: ChatStatus
  themePreference: ThemePreference
  workspaceError: Error | null
  workspaceLoading: boolean
  workspaceTree: WorkspaceTreeResponse | null
}) {
  const panelMeta = useMemo(() => {
    switch (rightPanel) {
      case "resources":
        return {
          title: "Pi Resources",
          icon: Library,
          loading: resourcesLoading,
          onRefresh: refreshResources,
          dataTestid: "pi-resources-canvas",
          mobileDataTestid: "pi-resources-mobile-panel",
        }
      case "workspace":
        return {
          title: "Workspace",
          icon: Folder,
          loading: workspaceLoading,
          onRefresh: refreshWorkspace,
          dataTestid: "pi-workspace-canvas",
          mobileDataTestid: "pi-workspace-mobile-panel",
        }
      case "configurations":
        return {
          title: "Configurations",
          icon: Settings,
          loading: false,
          onRefresh: undefined,
          dataTestid: "pi-config-canvas",
          mobileDataTestid: "pi-config-mobile-panel",
        }
      default:
        return {
          title: "",
          icon: Library,
          loading: false,
          onRefresh: undefined,
          dataTestid: "pi-unified-canvas",
          mobileDataTestid: "pi-unified-mobile-panel",
        }
    }
  }, [
    rightPanel,
    resourcesLoading,
    refreshResources,
    workspaceLoading,
    refreshWorkspace,
  ])

  const headerLauncher = (
    <RightPanelLauncher
      activePanel={rightPanel}
      onPanelChange={setRightPanel}
      placement="header"
      resources={resources}
      workspace={workspaceTree}
    />
  )

  return (
    <>
      <RightPanelLauncher
        activePanel={rightPanel}
        onPanelChange={setRightPanel}
        resources={resources}
        workspace={workspaceTree}
      />

      <MobilePanel
        dataTestid={panelMeta.mobileDataTestid}
        icon={panelMeta.icon}
        onClose={() => setRightPanel(null)}
        open={rightPanel !== null}
        title={panelMeta.title}
      >
        {rightPanel === "resources" && (
          <ResourcesPanelContent
            error={resourcesError}
            loading={resourcesLoading}
            resources={resources}
            workspace={workspaceTree}
          />
        )}
        {rightPanel === "workspace" && (
          <WorkspacePanelContent
            error={workspaceError}
            loading={workspaceLoading}
            workspace={workspaceTree}
          />
        )}
        {rightPanel === "configurations" && (
          <ConfigurationsPanelContent
            activityLabel={activityLabel}
            mode={mode}
            models={models}
            onThemePreferenceChange={handleThemePreferenceChange}
            planLabel={planLabel}
            queue={queue}
            resources={resources}
            saveSettings={saveSettings}
            selectedModelKey={selectedModelKey}
            settings={settings}
            settingsError={settingsError}
            settingsLoading={settingsLoading}
            status={status}
            themePreference={themePreference}
          />
        )}
      </MobilePanel>

      <ResizableCanvas
        key={rightPanel ?? "closed"}
        dataTestid={panelMeta.dataTestid}
        loading={panelMeta.loading}
        onClose={() => setRightPanel(null)}
        onRefresh={panelMeta.onRefresh}
        onResizeStart={handleResourceCanvasResizeStart}
        open={rightPanel !== null}
        headerActions={headerLauncher}
        title={panelMeta.title}
        titleIcon={panelMeta.icon}
        width={resourceCanvasWidth}
      >
        {rightPanel === "resources" && (
          <ResourcesPanelContent
            error={resourcesError}
            loading={resourcesLoading}
            resources={resources}
            workspace={workspaceTree}
          />
        )}
        {rightPanel === "workspace" && (
          <WorkspacePanelContent
            error={workspaceError}
            loading={workspaceLoading}
            workspace={workspaceTree}
          />
        )}
        {rightPanel === "configurations" && (
          <ConfigurationsPanelContent
            activityLabel={activityLabel}
            mode={mode}
            models={models}
            onThemePreferenceChange={handleThemePreferenceChange}
            planLabel={planLabel}
            queue={queue}
            resources={resources}
            saveSettings={saveSettings}
            selectedModelKey={selectedModelKey}
            settings={settings}
            settingsError={settingsError}
            settingsLoading={settingsLoading}
            status={status}
            themePreference={themePreference}
          />
        )}
      </ResizableCanvas>
    </>
  )
}
