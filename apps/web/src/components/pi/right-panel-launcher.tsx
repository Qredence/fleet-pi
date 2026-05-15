import { Folder, Library, Settings, X } from "lucide-react"
import { useEffect, useId, useRef } from "react"
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
  placement = "floating",
  resources,
  workspace,
}: {
  activePanel: RightPanel
  onPanelChange: (panel: RightPanel) => void
  placement?: "floating" | "header"
  resources: ChatResourcesResponse | null
  workspace: WorkspaceTreeResponse | null
}) {
  const totalResources = getResourceGroups(resources, workspace).reduce(
    (count, group) => count + group.items.length,
    0
  )
  const rootClass =
    placement === "header"
      ? "hidden min-[960px]:flex items-center gap-1"
      : `fixed top-3 right-3 z-50 flex items-center gap-1.5 ${
          activePanel ? "min-[960px]:hidden" : ""
        }`

  return (
    <div
      className={rootClass}
      data-testid={`right-panel-${placement}-launcher`}
    >
      <LauncherButton
        active={activePanel === "resources"}
        ariaLabel="Pi resources"
        badge={totalResources}
        icon={Library}
        label="Resources"
        placement={placement}
        onClick={() =>
          onPanelChange(activePanel === "resources" ? null : "resources")
        }
      />
      <LauncherButton
        active={activePanel === "workspace"}
        icon={Folder}
        label="Workspace"
        placement={placement}
        onClick={() =>
          onPanelChange(activePanel === "workspace" ? null : "workspace")
        }
      />
      <LauncherButton
        active={activePanel === "configurations"}
        icon={Settings}
        label="Configurations"
        placement={placement}
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
  placement,
}: {
  active: boolean
  ariaLabel?: string
  badge?: number
  icon: React.ElementType
  label: string
  onClick: () => void
  placement: "floating" | "header"
}) {
  const sizeClass =
    placement === "header"
      ? "h-7 rounded-[7px] px-2 text-[11px]"
      : "h-9 rounded-full px-3 text-[12px] shadow-sm backdrop-blur"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 border font-medium transition-colors ${sizeClass} ${
        active
          ? "border-border/70 bg-foreground/7 text-foreground/75"
          : "border-border/60 bg-background/70 text-foreground/50 hover:bg-foreground/6 hover:text-foreground/75"
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
  icon: Icon,
  onClose,
  open,
  title,
}: {
  children: ReactNode
  dataTestid?: string
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
        className="fixed inset-0 z-40 bg-black/20 min-[960px]:hidden"
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
        className="fixed top-14 right-3 bottom-3 z-50 flex min-h-0 max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 min-[960px]:hidden"
        data-testid={dataTestid}
      >
        <div
          ref={panelRef}
          className="h-full min-h-0 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-[8px] border border-border/70 bg-background/95 shadow-lg backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-label={title ? undefined : "Panel"}
          aria-labelledby={title ? panelTitleId : undefined}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose?.()
            }
          }}
        >
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            {title && (
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
                <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground/80">
                  {Icon && <Icon className="size-3.5 shrink-0" />}
                  <span id={panelTitleId}>{title}</span>
                </div>
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
