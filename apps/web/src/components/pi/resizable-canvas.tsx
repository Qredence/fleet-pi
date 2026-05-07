import { RefreshCw, X } from "lucide-react"
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react"

export function ResizableCanvas({
  children,
  dataTestid,
  loading,
  onClose,
  onRefresh,
  onResizeStart,
  open,
  title,
  titleIcon: TitleIcon,
  width,
}: {
  children: ReactNode
  dataTestid?: string
  loading: boolean
  onClose: () => void
  onRefresh?: () => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  open: boolean
  title: string
  titleIcon: React.ElementType
  width: number
}) {
  if (!open) return null

  return (
    <aside
      className="relative hidden h-svh shrink-0 border-l border-border/70 bg-background/95 lg:flex"
      data-testid={dataTestid}
      style={{ width }}
    >
      <button
        type="button"
        aria-label={`Resize ${title} panel`}
        className="absolute top-0 bottom-0 left-0 z-10 w-2 -translate-x-1 cursor-col-resize touch-none bg-transparent transition-colors outline-none hover:bg-foreground/10 focus-visible:bg-foreground/10"
        data-testid="pi-resources-resize-handle"
        onPointerDown={onResizeStart}
      />
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
          <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground/80">
            <TitleIcon className="size-3.5 shrink-0" />
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRefresh}
              disabled={!onRefresh}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-foreground/40"
              aria-label={`Refresh ${title}`}
              title={`Refresh ${title}`}
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70"
              aria-label="Close panel"
              title="Close panel"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">{children}</div>
      </div>
    </aside>
  )
}
