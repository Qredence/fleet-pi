import { Folder, Library, Settings } from "lucide-react"
import { ConfigurationsPanelContent } from "./pi/config-panel"
import { MobilePanel, RightPanelLauncher } from "./pi/right-panel-launcher"
import { ResizableCanvas } from "./pi/resizable-canvas"
import { ResourcesPanelContent } from "./pi/resources-panel"
import { WorkspacePanelContent } from "./pi/workspace-panel"
import type { PointerEvent as ReactPointerEvent } from "react"
import type { RightPanel, ThemePreference } from "@/lib/canvas-utils"
import type {
  ChatResourcesResponse,
  WorkspaceTreeResponse,
} from "@/lib/pi/chat-protocol"
import type { ChatModelOption } from "@/lib/pi/chat-helpers"

export function ChatRightPanels({
  handleResourceCanvasResizeStart,
  handleThemePreferenceChange,
  models,
  refreshResources,
  refreshWorkspace,
  resourceCanvasWidth,
  resources,
  resourcesError,
  resourcesLoading,
  rightPanel,
  setRightPanel,
  themePreference,
  workspaceError,
  workspaceLoading,
  workspaceTree,
}: {
  handleResourceCanvasResizeStart: (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void
  handleThemePreferenceChange: (preference: ThemePreference) => void
  models: Array<ChatModelOption>
  refreshResources: () => void
  refreshWorkspace: () => void
  resourceCanvasWidth: number
  resources: ChatResourcesResponse | null
  resourcesError: Error | null
  resourcesLoading: boolean
  rightPanel: RightPanel
  setRightPanel: (panel: RightPanel) => void
  themePreference: ThemePreference
  workspaceError: Error | null
  workspaceLoading: boolean
  workspaceTree: WorkspaceTreeResponse | null
}) {
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
        dataTestid="pi-resources-mobile-panel"
        open={rightPanel === "resources"}
      >
        <ResourcesPanelContent
          error={resourcesError}
          loading={resourcesLoading}
          resources={resources}
          workspace={workspaceTree}
        />
      </MobilePanel>
      <MobilePanel
        dataTestid="pi-workspace-mobile-panel"
        open={rightPanel === "workspace"}
      >
        <WorkspacePanelContent
          error={workspaceError}
          loading={workspaceLoading}
          workspace={workspaceTree}
        />
      </MobilePanel>
      <MobilePanel
        dataTestid="pi-config-mobile-panel"
        open={rightPanel === "configurations"}
      >
        <ConfigurationsPanelContent
          models={models}
          onThemePreferenceChange={handleThemePreferenceChange}
          themePreference={themePreference}
        />
      </MobilePanel>
      <ResizableCanvas
        dataTestid="pi-resources-canvas"
        loading={resourcesLoading}
        onClose={() => setRightPanel(null)}
        onRefresh={refreshResources}
        onResizeStart={handleResourceCanvasResizeStart}
        open={rightPanel === "resources"}
        headerActions={headerLauncher}
        title="Pi Resources"
        titleIcon={Library}
        width={resourceCanvasWidth}
      >
        <ResourcesPanelContent
          error={resourcesError}
          loading={resourcesLoading}
          resources={resources}
          workspace={workspaceTree}
        />
      </ResizableCanvas>
      <ResizableCanvas
        dataTestid="pi-workspace-canvas"
        loading={workspaceLoading}
        onClose={() => setRightPanel(null)}
        onRefresh={refreshWorkspace}
        onResizeStart={handleResourceCanvasResizeStart}
        open={rightPanel === "workspace"}
        headerActions={headerLauncher}
        title="Workspace"
        titleIcon={Folder}
        width={resourceCanvasWidth}
      >
        <WorkspacePanelContent
          error={workspaceError}
          loading={workspaceLoading}
          workspace={workspaceTree}
        />
      </ResizableCanvas>
      <ResizableCanvas
        dataTestid="pi-config-canvas"
        loading={false}
        onClose={() => setRightPanel(null)}
        onResizeStart={handleResourceCanvasResizeStart}
        open={rightPanel === "configurations"}
        headerActions={headerLauncher}
        title="Configurations"
        titleIcon={Settings}
        width={resourceCanvasWidth}
      >
        <ConfigurationsPanelContent
          models={models}
          onThemePreferenceChange={handleThemePreferenceChange}
          themePreference={themePreference}
        />
      </ResizableCanvas>
    </>
  )
}
