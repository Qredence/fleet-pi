/* eslint-disable max-lines */
import {
  BookOpen,
  Bot,
  Cable,
  CircleAlert,
  ClipboardList,
  Cpu,
  File,
  FileText,
  Folder,
  HardDrive,
  Library,
  Monitor,
  Moon,
  Palette,
  Plug,
  RefreshCw,
  Sun,
  Wrench,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Markdown } from "@workspace/ui/components/agent-elements/markdown"
import type { LucideIcon } from "lucide-react"
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react"
import type {
  ChatResourceInfo,
  ChatResourcesResponse,
  ChatThinkingLevel,
  WorkspaceFileResponse,
  WorkspaceTreeNode,
  WorkspaceTreeResponse,
} from "@/lib/pi/chat-protocol"

const RESOURCE_CANVAS_WIDTH_STORAGE_KEY = "fleet-pi-resource-canvas-width"
const THEME_PREFERENCE_STORAGE_KEY = "fleet-pi-theme-preference"
const RESOURCE_CANVAS_MIN_WIDTH = 320
const RESOURCE_CANVAS_VIEWPORT_RATIO = 0.7

type ResourceGroupId =
  | "skills"
  | "prompts"
  | "extensions"
  | "themes"
  | "agentsFiles"

export type ResourceCanvasTab = "resources" | "workspace" | "configurations"

export type ThemePreference = "light" | "dark" | "system"

export type ConfigModelInfo = {
  id: string
  name: string
  provider: string
  modelId: string
  version?: string
  reasoning?: boolean
  available?: boolean
  thinkingLevel?: ChatThinkingLevel
}

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

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system"

  const value = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system"
}

export function storeThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference)
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const dark = preference === "dark" || (preference === "system" && systemDark)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.dataset.theme = dark ? "dark" : "light"
}

export function ResourceLauncher({
  onOpenChange,
  open,
  resources,
  workspace,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  resources: ChatResourcesResponse | null
  workspace: WorkspaceTreeResponse | null
}) {
  const total = getResourceGroups(resources, workspace).reduce(
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
  models,
  onOpenChange,
  onRefresh,
  onRefreshWorkspace,
  onTabChange,
  onThemePreferenceChange,
  open,
  resources,
  requestInit,
  themePreference,
  workspace,
  workspaceError,
  workspaceLoading,
}: {
  activeTab: ResourceCanvasTab
  error?: Error | null
  loading: boolean
  models: Array<ConfigModelInfo>
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
  onRefreshWorkspace: () => void
  onTabChange: (tab: ResourceCanvasTab) => void
  onThemePreferenceChange: (preference: ThemePreference) => void
  open: boolean
  resources: ChatResourcesResponse | null
  requestInit?: RequestInit
  themePreference: ThemePreference
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
        models={models}
        onClose={() => onOpenChange(false)}
        onRefresh={onRefresh}
        onRefreshWorkspace={onRefreshWorkspace}
        onTabChange={onTabChange}
        onThemePreferenceChange={onThemePreferenceChange}
        requestInit={requestInit}
        resources={resources}
        shellClassName="w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-[8px] border border-border/70 bg-background/95 shadow-lg backdrop-blur"
        themePreference={themePreference}
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
  models,
  onClose,
  onRefresh,
  onRefreshWorkspace,
  onResizeStart,
  onTabChange,
  onThemePreferenceChange,
  open,
  resources,
  requestInit,
  themePreference,
  width,
  workspace,
  workspaceError,
  workspaceLoading,
}: {
  activeTab: ResourceCanvasTab
  error?: Error | null
  loading: boolean
  models: Array<ConfigModelInfo>
  onClose: () => void
  onRefresh: () => void
  onRefreshWorkspace: () => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onTabChange: (tab: ResourceCanvasTab) => void
  onThemePreferenceChange: (preference: ThemePreference) => void
  open: boolean
  resources: ChatResourcesResponse | null
  requestInit?: RequestInit
  themePreference: ThemePreference
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
        models={models}
        onClose={onClose}
        onRefresh={onRefresh}
        onRefreshWorkspace={onRefreshWorkspace}
        onTabChange={onTabChange}
        onThemePreferenceChange={onThemePreferenceChange}
        requestInit={requestInit}
        resources={resources}
        shellClassName="flex h-full min-w-0 flex-1 flex-col overflow-hidden"
        themePreference={themePreference}
        workspace={workspace}
        workspaceError={workspaceError}
        workspaceLoading={workspaceLoading}
      />
    </aside>
  )
}

function getResourceGroups(
  resources: ChatResourcesResponse | null,
  workspace: WorkspaceTreeResponse | null
): Array<{
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
      items: getWorkspaceSkillResources(workspace),
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
  models,
  onClose,
  onRefresh,
  onRefreshWorkspace,
  onTabChange,
  onThemePreferenceChange,
  requestInit,
  resources,
  shellClassName,
  themePreference,
  workspace,
  workspaceError,
  workspaceLoading,
}: {
  activeTab: ResourceCanvasTab
  bodyClassName: string
  error?: Error | null
  loading: boolean
  models: Array<ConfigModelInfo>
  onClose: () => void
  onRefresh: () => void
  onRefreshWorkspace: () => void
  onTabChange: (tab: ResourceCanvasTab) => void
  onThemePreferenceChange: (preference: ThemePreference) => void
  requestInit?: RequestInit
  resources: ChatResourcesResponse | null
  shellClassName: string
  themePreference: ThemePreference
  workspace: WorkspaceTreeResponse | null
  workspaceError?: Error | null
  workspaceLoading: boolean
}) {
  const groups = getResourceGroups(resources, workspace)
  const diagnostics = resources?.diagnostics ?? []
  const activeLoading =
    activeTab === "resources"
      ? loading || workspaceLoading
      : activeTab === "workspace"
        ? workspaceLoading
        : false
  const handleRefresh =
    activeTab === "resources" ? onRefresh : onRefreshWorkspace
  const refreshDisabled = activeTab === "configurations"

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
            onClick={refreshDisabled ? undefined : handleRefresh}
            disabled={refreshDisabled}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-foreground/40 transition-colors hover:bg-foreground/6 hover:text-foreground/70 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-foreground/40"
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
        <CanvasTabButton
          active={activeTab === "configurations"}
          label="Configurations"
          onClick={() => onTabChange("configurations")}
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
        ) : activeTab === "workspace" ? (
          <WorkspaceTab
            error={workspaceError}
            loading={workspaceLoading}
            requestInit={requestInit}
            workspace={workspace}
          />
        ) : (
          <ConfigurationsTab
            models={models}
            onThemePreferenceChange={onThemePreferenceChange}
            themePreference={themePreference}
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
        resources &&
        groups.map((group) => (
          <ResourceChipSection key={group.id} {...group} />
        ))}
      {!error && diagnostics.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-3">
          <ResourceChipSection
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

function ConfigurationsTab({
  models,
  onThemePreferenceChange,
  themePreference,
}: {
  models: Array<ConfigModelInfo>
  onThemePreferenceChange: (preference: ThemePreference) => void
  themePreference: ThemePreference
}) {
  const [allowedModelIds, setAllowedModelIds] = useState<Set<string>>(
    () => new Set(models.map((model) => model.id))
  )

  useEffect(() => {
    setAllowedModelIds((current) => {
      const next = new Set(current)
      for (const model of models) next.add(model.id)
      return next
    })
  }, [models])

  const toggleModel = (modelId: string, checked: boolean) => {
    setAllowedModelIds((current) => {
      const next = new Set(current)
      if (checked) next.add(modelId)
      else next.delete(modelId)
      return next
    })
  }

  return (
    <div className="space-y-3" data-testid="configurations-tab">
      <ConfigurationSection icon={Wrench} label="Tools">
        <ConfigurationRow
          action="Coming soon"
          description="Add Pi tools and project extensions to the active workspace."
          status="UI draft"
          title="Add tools"
        />
        <ConfigurationRow
          action="Manage"
          description="Review enabled coding, planning, research, and context tools."
          status="Local"
          title="Tool policy"
        />
      </ConfigurationSection>

      <ConfigurationSection icon={Cable} label="Connectors">
        <ConfigurationRow
          action="Add"
          description="Prepare external connectors such as GitHub, Linear, Drive, and Slack."
          status="UI draft"
          title="Connector catalog"
        />
      </ConfigurationSection>

      <ConfigurationSection icon={Cpu} label="LLM Providers">
        <ConfigurationRow
          action="Manage"
          description="Amazon Bedrock is the current provider; additional providers can be configured later."
          status="Active"
          title="Amazon Bedrock"
        />
        <ConfigurationRow
          action="Add"
          description="Reserve space for OpenAI-compatible, local, or custom provider entries."
          status="UI draft"
          title="Provider setup"
        />
      </ConfigurationSection>

      <ConfigurationSection icon={Bot} label="Allowed Models">
        {models.length === 0 ? (
          <div className="rounded-[6px] px-2 py-1.5 text-[12px] text-foreground/35">
            No models loaded.
          </div>
        ) : (
          models.map((model) => (
            <ModelAllowRow
              key={model.id}
              checked={allowedModelIds.has(model.id)}
              model={model}
              onCheckedChange={(checked) => toggleModel(model.id, checked)}
            />
          ))
        )}
      </ConfigurationSection>

      <ConfigurationSection icon={Palette} label="Personalization">
        <div className="rounded-[8px] border border-border/60 bg-foreground/[0.02] px-2.5 py-2">
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-foreground/75">
                Theme
              </div>
              <p className="mt-0.5 text-[11px] leading-4 text-foreground/40">
                Choose Light, Dark, or follow the system appearance.
              </p>
            </div>
          </div>
          <div className="flex rounded-[7px] bg-foreground/5 p-0.5">
            <ThemeSegment
              active={themePreference === "light"}
              icon={Sun}
              label="Light"
              onClick={() => onThemePreferenceChange("light")}
            />
            <ThemeSegment
              active={themePreference === "dark"}
              icon={Moon}
              label="Dark"
              onClick={() => onThemePreferenceChange("dark")}
            />
            <ThemeSegment
              active={themePreference === "system"}
              icon={Monitor}
              label="System"
              onClick={() => onThemePreferenceChange("system")}
            />
          </div>
        </div>
      </ConfigurationSection>
    </div>
  )
}

function ConfigurationSection({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode
  icon: LucideIcon
  label: string
}) {
  return (
    <div className="py-1">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium tracking-normal text-foreground/35 uppercase">
        <Icon className="size-3" />
        <span>{label}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function ConfigurationRow({
  action,
  description,
  status,
  title,
}: {
  action: string
  description: string
  status: string
  title: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[8px] border border-border/60 bg-foreground/[0.02] px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[12px] font-medium text-foreground/75">
            {title}
          </span>
          <span className="shrink-0 rounded-[4px] bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35">
            {status}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-foreground/40">
          {description}
        </p>
      </div>
      <button
        type="button"
        disabled
        className="shrink-0 rounded-[6px] border border-border/60 px-2 py-1 text-[11px] font-medium text-foreground/35"
      >
        {action}
      </button>
    </div>
  )
}

function ModelAllowRow({
  checked,
  model,
  onCheckedChange,
}: {
  checked: boolean
  model: ConfigModelInfo
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-[8px] border border-border/60 bg-foreground/[0.02] px-2.5 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="size-3.5 shrink-0 accent-foreground"
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[12px] font-medium text-foreground/75">
            {model.name}
          </span>
          <span className="shrink-0 rounded-[4px] bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35">
            {model.available === false ? "Unavailable" : "Available"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] leading-4 text-foreground/40">
          {model.provider} / {model.modelId}
        </p>
      </div>
    </label>
  )
}

function ThemeSegment({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-[6px] px-2 text-[11px] font-medium transition-colors ${
        active
          ? "bg-background text-foreground/75 shadow-sm"
          : "text-foreground/40 hover:text-foreground/65"
      }`}
    >
      <Icon className="size-3" />
      <span className="truncate">{label}</span>
    </button>
  )
}

function WorkspaceTab({
  error,
  loading,
  requestInit,
  workspace,
}: {
  error?: Error | null
  loading: boolean
  requestInit?: RequestInit
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
          `/api/workspace/file?path=${encodeURIComponent(selectedPath ?? "")}`,
          requestInit
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
  }, [requestInit, selectedPath, workspace])

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
            <ResourceChipSection
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

function getWorkspaceSkillResources(
  workspace: WorkspaceTreeResponse | null
): Array<ChatResourceInfo> {
  if (!workspace) return []

  const skillsRoot = findWorkspaceNode(
    workspace.nodes,
    "agent-workspace/skills"
  )
  if (!skillsRoot?.children?.length) return []

  return skillsRoot.children
    .filter((node) => node.type === "directory")
    .map((node) => {
      const skillFile =
        node.children?.find(
          (child) =>
            child.type === "file" &&
            child.name.toLowerCase() === "skill.md"
        ) ?? null

      return {
        name: node.name,
        path: skillFile?.path ?? node.path,
        source: "workspace",
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

function ResourceChipSection({
  id,
  icon: Icon,
  items,
  label,
}: {
  id: string
  icon: LucideIcon
  items: Array<ChatResourceInfo>
  label: string
}) {
  const stacked = id === "skills"

  return (
    <section
      className="grid grid-cols-[82px_minmax(0,1fr)] gap-x-3 gap-y-2 py-2.5"
      aria-label={`${label} resources`}
    >
      <div className="flex min-w-0 items-center self-start pt-1.5 text-[14px] leading-5 text-foreground/45">
        <span className="truncate underline decoration-foreground/25 underline-offset-2">
          {label}
        </span>
        <span className="ml-1 shrink-0 text-[11px] leading-4 text-foreground/30 tabular-nums no-underline">
          {items.length}
        </span>
      </div>
      <div
        className={
          stacked
            ? "flex min-w-0 flex-col items-stretch gap-1.5"
            : "flex min-w-0 flex-wrap items-start gap-2"
        }
        role="list"
        data-testid={`resource-chip-section-${label.toLowerCase()}`}
      >
        {items.length === 0 ? (
          <span className="inline-flex h-[30px] items-center rounded-[10px] border border-border/60 bg-background px-3 text-[14px] leading-5 text-foreground/35 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06)]">
            Empty
          </span>
        ) : (
          items.map((item) => (
            <ResourceChip
              key={resourceKey(item)}
              icon={Icon}
              item={item}
              stacked={stacked}
            />
          ))
        )}
      </div>
    </section>
  )
}

function ResourceChip({
  icon,
  item,
  stacked = false,
}: {
  icon: LucideIcon
  item: ChatResourceInfo
  stacked?: boolean
}) {
  const title = getResourceChipTitle(item)

  return (
    <div
      role="listitem"
      className={`max-w-full rounded-[10px] border border-border/70 bg-background px-2.5 text-[14px] leading-5 text-foreground/80 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06)] ${
        stacked
          ? "flex min-h-[36px] w-full min-w-0 items-center gap-2 py-1.5"
          : "inline-flex h-[30px] items-center gap-1"
      }`}
      aria-label={title}
      data-testid="resource-chip"
      title={title}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ResourceChipIcon icon={icon} />
        <span className="min-w-0 truncate">{item.name}</span>
      </div>
      {item.source && (
        <span className="max-w-20 shrink-0 truncate rounded-[5px] bg-foreground/5 px-1.5 py-0.5 text-[10px] leading-3 text-foreground/35">
          {item.source}
        </span>
      )}
    </div>
  )
}

function ResourceChipIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.04] text-foreground/45">
      <Icon className="size-3.5" />
    </span>
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

export function displayResourcePath(path: string) {
  const marker = "/fleet-pi/"
  const index = path.indexOf(marker)
  return index >= 0 ? path.slice(index + marker.length) : path
}

export function getResourceChipTitle(item: ChatResourceInfo) {
  return [
    item.name,
    item.source ? `Source: ${item.source}` : null,
    item.description ?? null,
    item.path ? displayResourcePath(item.path) : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export function resourceKey(item: ChatResourceInfo) {
  return `${item.source ?? "resource"}:${item.path ?? item.name}`
}
