import {
  BookOpen,
  CircleAlert,
  ClipboardList,
  FileText,
  Library,
  Palette,
  Plug,
  RefreshCw,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { PointerEvent as ReactPointerEvent } from "react"
import type {
  ChatResourceInfo,
  ChatResourcesResponse,
} from "@/lib/pi/chat-protocol"

const RESOURCE_CANVAS_WIDTH_STORAGE_KEY = "fleet-pi-resource-canvas-width"
const RESOURCE_CANVAS_DEFAULT_WIDTH = 380
const RESOURCE_CANVAS_MIN_WIDTH = 320
const RESOURCE_CANVAS_MAX_WIDTH = 560

type ResourceGroupId =
  | "skills"
  | "prompts"
  | "extensions"
  | "themes"
  | "agentsFiles"

export function clampResourceCanvasWidth(width: number) {
  return Math.min(
    RESOURCE_CANVAS_MAX_WIDTH,
    Math.max(RESOURCE_CANVAS_MIN_WIDTH, Math.round(width))
  )
}

export function readStoredResourceCanvasWidth() {
  if (typeof window === "undefined") return RESOURCE_CANVAS_DEFAULT_WIDTH

  const value = Number(
    window.localStorage.getItem(RESOURCE_CANVAS_WIDTH_STORAGE_KEY)
  )
  return Number.isFinite(value)
    ? clampResourceCanvasWidth(value)
    : RESOURCE_CANVAS_DEFAULT_WIDTH
}

export function storeResourceCanvasWidth(width: number) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    RESOURCE_CANVAS_WIDTH_STORAGE_KEY,
    String(clampResourceCanvasWidth(width))
  )
}

export function ResourceLauncher({
  onOpenChange,
  open,
  resources,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  resources: ChatResourcesResponse | null
}) {
  const total = getResourceGroups(resources).reduce(
    (count, group) => count + group.items.length,
    0
  )

  return (
    <div
      className={`fixed top-3 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 ${
        open ? "lg:hidden" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background/85 px-3 text-[12px] font-medium text-foreground/55 shadow-sm backdrop-blur transition-colors hover:bg-background hover:text-foreground/75"
        aria-expanded={open}
        aria-label="Pi resources"
        title="Pi resources"
      >
        <Library className="size-3.5" />
        <span>{total}</span>
      </button>
    </div>
  )
}

export function ResourceMobilePanel({
  error,
  loading,
  onOpenChange,
  onRefresh,
  open,
  resources,
}: {
  error?: Error | null
  loading: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
  open: boolean
  resources: ChatResourcesResponse | null
}) {
  if (!open) return null

  return (
    <div
      className="fixed top-14 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 lg:hidden"
      data-testid="pi-resources-mobile-panel"
    >
      <ResourcePanel
        bodyClassName="max-h-[min(620px,calc(100svh-5.75rem))]"
        error={error}
        loading={loading}
        onClose={() => onOpenChange(false)}
        onRefresh={onRefresh}
        resources={resources}
        shellClassName="w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-[8px] border border-border/70 bg-background/95 shadow-lg backdrop-blur"
      />
    </div>
  )
}

export function ResourceCanvas({
  error,
  loading,
  onClose,
  onRefresh,
  onResizeStart,
  open,
  resources,
  width,
}: {
  error?: Error | null
  loading: boolean
  onClose: () => void
  onRefresh: () => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  open: boolean
  resources: ChatResourcesResponse | null
  width: number
}) {
  if (!open) return null

  return (
    <aside
      className="relative hidden h-svh shrink-0 border-l border-border/70 bg-background/95 lg:flex"
      data-testid="pi-resources-canvas"
      style={{ width }}
    >
      <button
        type="button"
        aria-label="Resize resources canvas"
        className="absolute top-0 bottom-0 left-0 z-10 w-2 -translate-x-1 cursor-col-resize touch-none bg-transparent transition-colors outline-none hover:bg-foreground/10 focus-visible:bg-foreground/10"
        data-testid="pi-resources-resize-handle"
        onPointerDown={onResizeStart}
      />
      <ResourcePanel
        bodyClassName="flex-1"
        error={error}
        loading={loading}
        onClose={onClose}
        onRefresh={onRefresh}
        resources={resources}
        shellClassName="flex h-full min-w-0 flex-1 flex-col overflow-hidden"
      />
    </aside>
  )
}

function getResourceGroups(resources: ChatResourcesResponse | null): Array<{
  id: ResourceGroupId
  label: string
  icon: LucideIcon
  items: Array<ChatResourceInfo>
}> {
  return [
    {
      id: "skills",
      label: "Skills",
      icon: BookOpen,
      items: resources?.skills ?? [],
    },
    {
      id: "prompts",
      label: "Prompts",
      icon: FileText,
      items: resources?.prompts ?? [],
    },
    {
      id: "extensions",
      label: "Extensions",
      icon: Plug,
      items: resources?.extensions ?? [],
    },
    {
      id: "themes",
      label: "Themes",
      icon: Palette,
      items: resources?.themes ?? [],
    },
    {
      id: "agentsFiles",
      label: "Context",
      icon: ClipboardList,
      items: resources?.agentsFiles ?? [],
    },
  ]
}

function ResourcePanel({
  bodyClassName,
  error,
  loading,
  onClose,
  onRefresh,
  resources,
  shellClassName,
}: {
  bodyClassName: string
  error?: Error | null
  loading: boolean
  onClose: () => void
  onRefresh: () => void
  resources: ChatResourcesResponse | null
  shellClassName: string
}) {
  const groups = getResourceGroups(resources)
  const diagnostics = resources?.diagnostics ?? []

  return (
    <section className={shellClassName}>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground/80">
          <Library className="size-3.5 shrink-0" />
          <span>Pi Resources</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70"
            aria-label="Refresh resources"
            title="Refresh resources"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70"
            aria-label="Close resources"
            title="Close resources"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className={`${bodyClassName} overflow-y-auto px-3 py-2`}>
        {error && (
          <ResourceNotice
            icon={CircleAlert}
            title="Unable to load resources"
            description={error.message}
          />
        )}
        {!error && loading && !resources && (
          <ResourceNotice
            icon={RefreshCw}
            title="Loading resources"
            description="Scanning project and agent directories."
          />
        )}
        {!error &&
          groups.map((group) => <ResourceGroup key={group.id} {...group} />)}
        {!error && diagnostics.length > 0 && (
          <div className="mt-2 border-t border-border/60 pt-2">
            <ResourceGroup
              id="diagnostics"
              label="Diagnostics"
              icon={CircleAlert}
              items={diagnostics.map((diagnostic, index) => ({
                name: `Diagnostic ${index + 1}`,
                description: diagnostic,
              }))}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function ResourceGroup({
  icon: Icon,
  items,
  label,
}: {
  id: string
  icon: LucideIcon
  items: Array<ChatResourceInfo>
  label: string
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium tracking-normal text-foreground/35 uppercase">
        <Icon className="size-3" />
        <span>{label}</span>
        <span className="ml-auto tabular-nums">{items.length}</span>
      </div>
      <div className="space-y-1">
        {items.length === 0 ? (
          <div className="rounded-[6px] px-2 py-1.5 text-[12px] text-foreground/35">
            Empty
          </div>
        ) : (
          items.map((item) => (
            <ResourceItem key={resourceKey(item)} item={item} />
          ))
        )}
      </div>
    </div>
  )
}

function ResourceItem({ item }: { item: ChatResourceInfo }) {
  return (
    <div className="rounded-[6px] px-2 py-1.5 transition-colors hover:bg-foreground/5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/70">
          {item.name}
        </span>
        {item.source && (
          <span className="shrink-0 rounded-[4px] bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35">
            {item.source}
          </span>
        )}
      </div>
      {item.description && (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-foreground/40">
          {item.description}
        </p>
      )}
      {item.path && (
        <p className="mt-0.5 truncate text-[10px] text-foreground/25">
          {displayResourcePath(item.path)}
        </p>
      )}
    </div>
  )
}

function ResourceNotice({
  description,
  icon: Icon,
  title,
}: {
  description: string
  icon: LucideIcon
  title: string
}) {
  return (
    <div className="my-1.5 rounded-[6px] bg-foreground/5 px-2.5 py-2">
      <div className="flex items-center gap-2 text-[12px] font-medium text-foreground/65">
        <Icon className="size-3.5" />
        <span>{title}</span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-foreground/40">
        {description}
      </p>
    </div>
  )
}

function displayResourcePath(path: string) {
  const marker = "/fleet-pi/"
  const index = path.indexOf(marker)
  return index >= 0 ? path.slice(index + marker.length) : path
}

function resourceKey(item: ChatResourceInfo) {
  return `${item.source ?? "resource"}:${item.path ?? item.name}`
}
