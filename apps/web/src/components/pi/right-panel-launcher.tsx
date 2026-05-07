import { Folder, Library, Settings } from "lucide-react"
import { getResourceGroups } from "./shared"
import type { ReactNode } from "react"
import type { RightPanel } from "@/lib/canvas-utils"
import type {
  ChatResourcesResponse,
  WorkspaceTreeResponse,
} from "@/lib/pi/chat-protocol"

export function RightPanelLauncher({
  activePanel,
  onPanelChange,
  resources,
  workspace,
}: {
  activePanel: RightPanel
  onPanelChange: (panel: RightPanel) => void
  resources: ChatResourcesResponse | null
  workspace: WorkspaceTreeResponse | null
}) {
  const totalResources = getResourceGroups(resources, workspace).reduce(
    (count, group) => count + group.items.length,
    0
  )

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5">
      <LauncherButton
        active={activePanel === "resources"}
        ariaLabel="Pi resources"
        badge={totalResources}
        icon={Library}
        label="Resources"
        onClick={() =>
          onPanelChange(activePanel === "resources" ? null : "resources")
        }
      />
      <LauncherButton
        active={activePanel === "workspace"}
        icon={Folder}
        label="Workspace"
        onClick={() =>
          onPanelChange(activePanel === "workspace" ? null : "workspace")
        }
      />
      <LauncherButton
        active={activePanel === "configurations"}
        icon={Settings}
        label="Configurations"
        onClick={() =>
          onPanelChange(
            activePanel === "configurations" ? null : "configurations"
          )
        }
      />
    </div>
  )
}

function LauncherButton({
  active,
  ariaLabel,
  badge,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  ariaLabel?: string
  badge?: number
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium shadow-sm backdrop-blur transition-colors ${
        active
          ? "border-border/70 bg-background text-foreground/75"
          : "border-border/70 bg-background/85 text-foreground/55 hover:bg-background hover:text-foreground/75"
      }`}
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      title={ariaLabel ?? label}
    >
      <Icon className="size-3.5" />
      {badge !== undefined && <span>{badge}</span>}
    </button>
  )
}

export function MobilePanel({
  children,
  dataTestid,
  open,
}: {
  children: ReactNode
  dataTestid?: string
  open: boolean
}) {
  if (!open) return null

  return (
    <div
      className="fixed top-14 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 lg:hidden"
      data-testid={dataTestid}
    >
      <div className="max-h-[min(620px,calc(100svh-5.75rem))] w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-[8px] border border-border/70 bg-background/95 shadow-lg backdrop-blur">
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-2">{children}</div>
        </div>
      </div>
    </div>
  )
}
