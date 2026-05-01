import {
  BookOpen,
  CircleAlert,
  ClipboardList,
  File,
  FileText,
  Folder,
  HardDrive,
  Library,
  Palette,
  Plug,
  RefreshCw,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Markdown } from "@workspace/ui/components/agent-elements/markdown"
import type { LucideIcon } from "lucide-react"
import type { PointerEvent as ReactPointerEvent } from "react"
import type {
  ChatResourceInfo,
  ChatResourcesResponse,
  WorkspaceFileResponse,
  WorkspaceTreeNode,
  WorkspaceTreeResponse,
} from "@/lib/pi/chat-protocol"

const RESOURCE_CANVAS_WIDTH_STORAGE_KEY = "fleet-pi-resource-canvas-width"
const RESOURCE_CANVAS_MIN_WIDTH = 320
const RESOURCE_CANVAS_VIEWPORT_RATIO = 0.7

type ResourceGroupId =
  | "skills"
  | "prompts"
  | "extensions"
  | "themes"
  | "agentsFiles"

export type ResourceCanvasTab = "resources" | "workspace"

export function getResourceCanvasInitialWidth() {
  if (typeof window === "undefined") return RESOURCE_CANVAS_MIN_WIDTH
  return getResourceCanvasMaxWidth()
}

export function getResourceCanvasMaxWidth() {
  if (typeof window === "undefined") return RESOURCE_CANVAS_MIN_WIDTH
  return Math.max(
    RESOURCE_CANVAS_MIN_WIDTH,
    Math.floor(window.innerWidth * RESOURCE_CANVAS_VIEWPORT_RATIO)
  )
}

export function clampResourceCanvasWidth(width: number) {
  return Math.min(
    getResourceCanvasMaxWidth(),
    Math.max(RESOURCE_CANVAS_MIN_WIDTH, Math.round(width))
  )
}

export function readStoredResourceCanvasWidth() {
  if (typeof window === "undefined") return getResourceCanvasInitialWidth()

  const value = Number(
    window.localStorage.getItem(RESOURCE_CANVAS_WIDTH_STORAGE_KEY)
  )
  return Number.isFinite(value)
    ? clampResourceCanvasWidth(value)
    : getResourceCanvasInitialWidth()
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
  activeTab,
  error,
  loading,
  onOpenChange,
  onRefresh,
  onRefreshWorkspace,
  onTabChange,
  open,
  resources,
  workspace,
  workspaceError,
  workspaceLoading,
}: {
  activeTab: ResourceCanvasTab
  error?: Error | null
  loading: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
  onRefreshWorkspace: () => void
  onTabChange: (tab: ResourceCanvasTab) => void
  open: boolean
  resources: ChatResourcesResponse | null
  workspace: WorkspaceTreeResponse | null
  workspaceError?: Error | null
  workspaceLoading: boolean
}) {
  if (!open) return null

  return (
    <div
      className="fixed top-14 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 lg:hidden"
      data-testid="pi-resources-mobile-panel"
    >
      <ResourcePanel
        activeTab={activeTab}
        bodyClassName="max-h-[min(620px,calc(100svh-5.75rem))]"
        error={error}
        loading={loading}
        onClose={() => onOpenChange(false)}
        onRefresh={onRefresh}
        onRefreshWorkspace={onRefreshWorkspace}
        onTabChange={onTabChange}
        resources={resources}
        shellClassName="w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-[8px] border border-border/70 bg-background/95 shadow-lg backdrop-blur"
        workspace={workspace}
        workspaceError={workspaceError}
        workspaceLoading={workspaceLoading}
      />
    </div>
  )
}

export function ResourceCanvas({
  activeTab,
  error,
  loading,
  onClose,
  onRefresh,
  onRefreshWorkspace,
  onResizeStart,
  onTabChange,
  open,
  resources,
  width,
  workspace,
  workspaceError,
  workspaceLoading,
}: {
  activeTab: ResourceCanvasTab
  error?: Error | null
  loading: boolean
  onClose: () => void
  onRefresh: () => void
  onRefreshWorkspace: () => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onTabChange: (tab: ResourceCanvasTab) => void
  open: boolean
  resources: ChatResourcesResponse | null
  width: number
  workspace: WorkspaceTreeResponse | null
  workspaceError?: Error | null
  workspaceLoading: boolean
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
        activeTab={activeTab}
        bodyClassName="flex-1"
        error={error}
        loading={loading}
        onClose={onClose}
        onRefresh={onRefresh}
        onRefreshWorkspace={onRefreshWorkspace}
        onTabChange={onTabChange}
        resources={resources}
        shellClassName="flex h-full min-w-0 flex-1 flex-col overflow-hidden"
        workspace={workspace}
        workspaceError={workspaceError}
        workspaceLoading={workspaceLoading}
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
  activeTab,
  bodyClassName,
  error,
  loading,
  onClose,
  onRefresh,
  onRefreshWorkspace,
  onTabChange,
  resources,
  shellClassName,
  workspace,
  workspaceError,
  workspaceLoading,
}: {
  activeTab: ResourceCanvasTab
  bodyClassName: string
  error?: Error | null
  loading: boolean
  onClose: () => void
  onRefresh: () => void
  onRefreshWorkspace: () => void
  onTabChange: (tab: ResourceCanvasTab) => void
  resources: ChatResourcesResponse | null
  shellClassName: string
  workspace: WorkspaceTreeResponse | null
  workspaceError?: Error | null
  workspaceLoading: boolean
}) {
  const groups = getResourceGroups(resources)
  const diagnostics = resources?.diagnostics ?? []
  const activeLoading = activeTab === "resources" ? loading : workspaceLoading
  const handleRefresh =
    activeTab === "resources" ? onRefresh : onRefreshWorkspace

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
            onClick={handleRefresh}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70"
            aria-label={`Refresh ${activeTab}`}
            title={`Refresh ${activeTab}`}
          >
            <RefreshCw
              className={`size-3.5 ${activeLoading ? "animate-spin" : ""}`}
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
      <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-3 py-1.5">
        <CanvasTabButton
          active={activeTab === "resources"}
          label="Resources"
          onClick={() => onTabChange("resources")}
        />
        <CanvasTabButton
          active={activeTab === "workspace"}
          label="Workspace"
          onClick={() => onTabChange("workspace")}
        />
      </div>
      <div className={`${bodyClassName} overflow-y-auto px-3 py-2`}>
        {activeTab === "resources" ? (
          <ResourcesTab
            diagnostics={diagnostics}
            error={error}
            groups={groups}
            loading={loading}
            resources={resources}
          />
        ) : (
          <WorkspaceTab
            error={workspaceError}
            loading={workspaceLoading}
            workspace={workspace}
          />
        )}
      </div>
    </section>
  )
}

function CanvasTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-7 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors ${
        active
          ? "bg-foreground/8 text-foreground/75"
          : "text-foreground/40 hover:bg-foreground/6 hover:text-foreground/65"
      }`}
    >
      {label}
    </button>
  )
}

function ResourcesTab({
  diagnostics,
  error,
  groups,
  loading,
  resources,
}: {
  diagnostics: Array<string>
  error?: Error | null
  groups: ReturnType<typeof getResourceGroups>
  loading: boolean
  resources: ChatResourcesResponse | null
}) {
  return (
    <>
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
    </>
  )
}

function WorkspaceTab({
  error,
  loading,
  workspace,
}: {
  error?: Error | null
  loading: boolean
  workspace: WorkspaceTreeResponse | null
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [preview, setPreview] = useState<WorkspaceFileResponse | null>(null)
  const [previewError, setPreviewError] = useState<Error | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!workspace || !selectedPath) return
    if (findWorkspaceNode(workspace.nodes, selectedPath)?.type === "file") {
      return
    }

    setSelectedPath(null)
    setPreview(null)
    setPreviewError(null)
  }, [selectedPath, workspace])

  useEffect(() => {
    if (!selectedPath) return

    let cancelled = false
    async function loadPreview() {
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const response = await fetch(
          `/api/workspace/file?path=${encodeURIComponent(selectedPath ?? "")}`
        )
        const body: unknown = await response.json()
        if (!response.ok) {
          const message =
            body &&
            typeof body === "object" &&
            "message" in body &&
            typeof body.message === "string"
              ? body.message
              : "Unable to load workspace file."
          throw new Error(message)
        }
        if (!cancelled) setPreview(body as WorkspaceFileResponse)
      } catch (err) {
        if (!cancelled) {
          setPreview(null)
          setPreviewError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }

    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [selectedPath, workspace])

  if (error) {
    return (
      <ResourceNotice
        icon={CircleAlert}
        title="Unable to load workspace"
        description={error.message}
      />
    )
  }

  if (loading && !workspace) {
    return (
      <ResourceNotice
        icon={RefreshCw}
        title="Loading workspace"
        description="Reading agent-workspace."
      />
    )
  }

  if (!workspace) {
    return (
      <ResourceNotice
        icon={HardDrive}
        title="Workspace unavailable"
        description="agent-workspace has not been loaded yet."
      />
    )
  }

  return (
    <div className="grid min-h-0 gap-2 lg:grid-cols-[minmax(150px,0.9fr)_minmax(180px,1.1fr)]">
      <div data-testid="workspace-tree" className="min-w-0">
        <div className="mb-2 flex min-w-0 items-center gap-2 rounded-[6px] bg-foreground/5 px-2 py-1.5">
          <HardDrive className="size-3.5 shrink-0 text-foreground/45" />
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/70">
            {workspace.root}
          </span>
        </div>
        <div className="space-y-0.5">
          {workspace.nodes.map((node) => (
            <WorkspaceNode
              key={node.path}
              depth={0}
              node={node}
              onSelect={setSelectedPath}
              selectedPath={selectedPath}
            />
          ))}
        </div>
        {workspace.diagnostics.length > 0 && (
          <div className="mt-2 border-t border-border/60 pt-2">
            <ResourceGroup
              id="workspace-diagnostics"
              label="Diagnostics"
              icon={CircleAlert}
              items={workspace.diagnostics.map((diagnostic, index) => ({
                name: `Diagnostic ${index + 1}`,
                description: diagnostic,
              }))}
            />
          </div>
        )}
      </div>
      <WorkspacePreview
        error={previewError}
        loading={previewLoading}
        preview={preview}
        selectedPath={selectedPath}
      />
    </div>
  )
}

function WorkspaceNode({
  depth,
  node,
  onSelect,
  selectedPath,
}: {
  depth: number
  node: WorkspaceTreeNode
  onSelect: (path: string) => void
  selectedPath: string | null
}) {
  const Icon = node.type === "directory" ? Folder : File
  const selected = node.type === "file" && node.path === selectedPath
  const className = `flex min-w-0 items-center gap-2 rounded-[6px] px-2 py-1 text-[12px] transition-colors ${
    selected
      ? "bg-foreground/8 text-foreground/80"
      : "text-foreground/65 hover:bg-foreground/5"
  }`
  const style = { paddingLeft: `${8 + depth * 14}px` }

  return (
    <div>
      {node.type === "file" ? (
        <button
          type="button"
          aria-pressed={selected}
          className={`${className} w-full text-left`}
          style={style}
          title={node.path}
          onClick={() => onSelect(node.path)}
        >
          <Icon className="size-3.5 shrink-0 text-foreground/35" />
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        </button>
      ) : (
        <div className={className} style={style} title={node.path}>
          <Icon className="size-3.5 shrink-0 text-foreground/35" />
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        </div>
      )}
      {node.children?.map((child) => (
        <WorkspaceNode
          key={child.path}
          depth={depth + 1}
          node={child}
          onSelect={onSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  )
}

function WorkspacePreview({
  error,
  loading,
  preview,
  selectedPath,
}: {
  error: Error | null
  loading: boolean
  preview: WorkspaceFileResponse | null
  selectedPath: string | null
}) {
  return (
    <div
      className="min-h-[220px] min-w-0 rounded-[8px] border border-border/60 bg-background"
      data-testid="workspace-preview"
    >
      <div className="flex min-h-9 min-w-0 items-center gap-2 border-b border-border/60 px-2.5">
        <FileText className="size-3.5 shrink-0 text-foreground/35" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/70">
          {preview?.name ?? selectedPath ?? "Preview"}
        </span>
      </div>
      <div className="max-h-[min(520px,calc(100svh-12rem))] overflow-y-auto px-3 py-2">
        {!selectedPath && (
          <ResourceNotice
            icon={FileText}
            title="Select a file"
            description="Choose a workspace file to preview its Markdown."
          />
        )}
        {selectedPath && loading && (
          <ResourceNotice
            icon={RefreshCw}
            title="Loading preview"
            description={selectedPath}
          />
        )}
        {selectedPath && error && (
          <ResourceNotice
            icon={CircleAlert}
            title="Unable to load preview"
            description={error.message}
          />
        )}
        {selectedPath && !loading && !error && preview && (
          <Markdown
            className="text-[12px] leading-relaxed"
            content={preview.content}
          />
        )}
      </div>
    </div>
  )
}

function findWorkspaceNode(
  nodes: Array<WorkspaceTreeNode>,
  path: string
): WorkspaceTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    const child = node.children ? findWorkspaceNode(node.children, path) : null
    if (child) return child
  }

  return null
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
