import { Folder, Library, Settings, X } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import {
  DESKTOP_PANEL_HIDDEN_FLEX,
  DESKTOP_PANEL_ONLY,
} from "../../../lib/layout-constants"
import { useRightPanelContext } from "../layout/right-panel-context"
import { getResourceGroups } from "./shared"
import type { ReactNode } from "react"
import type { RightPanel } from "../../../lib/canvas-utils"
import type {
  ChatResourcesResponse,
  WorkspaceTreeResponse,
} from "../../../lib/pi/chat-protocol"

export type RightPanelLauncherPlacement = "inline" | "header" | "panel"

/** Reads panel state from RightPanelProvider — no prop threading from route. */
export function RightPanelLauncherFromContext({
  placement,
}: {
  placement: RightPanelLauncherPlacement
}) {
  const { rightPanel, setRightPanel, resources, workspaceTree } =
    useRightPanelContext()

  if (placement === "inline" && rightPanel !== null) return null
  if (placement !== "inline" && rightPanel === null) return null

  return (
    <RightPanelLauncher
      activePanel={rightPanel}
      onPanelChange={setRightPanel}
      placement={placement}
      resources={resources}
      workspace={workspaceTree}
    />
  )
}

const PLACEMENT_ROOT_CLASS: Record<RightPanelLauncherPlacement, string> = {
  inline: "flex items-center gap-1.5",
  header: `${DESKTOP_PANEL_HIDDEN_FLEX} items-center gap-1`,
  panel: `flex ${DESKTOP_PANEL_ONLY} items-center gap-1`,
}

export function RightPanelLauncher({
  activePanel,
  onPanelChange,
  placement = "inline",
  resources,
  workspace,
}: {
  activePanel: RightPanel
  onPanelChange: (panel: RightPanel) => void
  placement?: RightPanelLauncherPlacement
  resources: ChatResourcesResponse | null
  workspace: WorkspaceTreeResponse | null
}) {
  const totalResources = getResourceGroups(resources, workspace).reduce(
    (count, group) => count + group.items.length,
    0
  )

  const compact = placement === "header" || placement === "panel"

  return (
    <div
      className={PLACEMENT_ROOT_CLASS[placement]}
      data-testid={`right-panel-${placement}-launcher`}
    >
      <LauncherButton
        active={activePanel === "resources"}
        ariaLabel="Pi resources"
        badge={totalResources}
        compact={compact}
        icon={Library}
        label="Resources"
        onClick={() =>
          onPanelChange(activePanel === "resources" ? null : "resources")
        }
      />
      <LauncherButton
        active={activePanel === "workspace"}
        compact={compact}
        icon={Folder}
        label="Workspace"
        onClick={() =>
          onPanelChange(activePanel === "workspace" ? null : "workspace")
        }
      />
      <LauncherButton
        active={activePanel === "configurations"}
        compact={compact}
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
  compact,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  ariaLabel?: string
  badge?: number
  compact: boolean
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  const sizeClass = compact
    ? "h-7 rounded-[7px] px-2 text-[11px]"
    : "h-9 rounded-full px-3 text-[12px] shadow-sm backdrop-blur"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 border font-medium transition-colors ${sizeClass} ${
        active
          ? "border-border/70 bg-foreground/7 text-foreground/75"
          : "border-border/60 bg-sidebar text-foreground/50 hover:bg-foreground/6 hover:text-foreground/75"
      }`}
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      title={ariaLabel ?? label}
    >
      <Icon className="size-3.5" />
      {active && <span className="hidden sm:inline">{label}</span>}
      {badge !== undefined && <span>{badge}</span>}
    </button>
  )
}

export function MobilePanel({
  children,
  dataTestid,
  headerActions,
  icon: Icon,
  onClose,
  open,
  title,
}: {
  children: ReactNode
  dataTestid?: string
  headerActions?: ReactNode
  icon?: React.ElementType
  onClose?: () => void
  open: boolean
  title?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const panelTitleId = useId()

  useEffect(() => {
    if (open) {
      panelRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 ${DESKTOP_PANEL_ONLY}`}
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close panel"
        onKeyDown={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " " ||
            event.key === "Escape"
          ) {
            event.preventDefault()
            onClose?.()
          }
        }}
      />
      <div
        className={`fixed right-3 bottom-3 z-50 flex min-h-0 max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 ${DESKTOP_PANEL_ONLY}`}
        data-testid={dataTestid}
        style={{ top: "var(--chat-chrome-top)" }}
      >
        <div
          ref={panelRef}
          className="h-full min-h-0 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-[8px] border border-border/70 bg-background/95 shadow-lg backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-labelledby={panelTitleId}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose?.()
            }
          }}
        >
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <span id={panelTitleId} className="sr-only">
              {title ?? "Panel"}
            </span>
            {title && (
              <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3">
                <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground/80">
                  {Icon && <Icon className="size-3.5 shrink-0" />}
                  <span className="truncate">{title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {headerActions}
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70"
                      aria-label="Close panel"
                      title="Close panel"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
