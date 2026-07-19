import {
  ChevronRight,
  CircleAlert,
  File,
  FileText,
  Folder,
  HardDrive,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Markdown } from "../../agent-elements/markdown"
import { Button } from "../../button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../collapsible"
import {
  CHAT_PANEL_BREAKPOINT_PX,
  WORKSPACE_SPLIT_GAP_RESET,
  WORKSPACE_SPLIT_HIDDEN_BLOCK,
} from "../../../lib/layout-constants"
import { isPathWithinScope } from "../../../lib/workspace-path-nav"
import { useWorkspaceSplitLayout } from "./hooks/use-workspace-split-layout"
import {
  ResourceChipSection,
  ResourceNotice,
  findWorkspaceNode,
} from "./shared"
import { WorkspacePreviewSkeleton, WorkspaceSkeleton } from "./skeleton-loaders"
import type { RefObject } from "react"
import type {
  WorkspaceFileResponse,
  WorkspaceTreeNode,
  WorkspaceTreeResponse,
} from "../../../lib/pi/chat-protocol"

export type WorkspacePanelContentProps = {
  error?: Error | null
  emptyDescription?: string
  emptyTitle?: string
  loadWorkspaceFile: (path: string) => Promise<WorkspaceFileResponse>
  loading: boolean
  onRefresh?: () => void
  onSelectedPathChange?: (path: string | null) => void
  previewEmptyDescription?: string
  previewEmptyTitle?: string
  scopePath?: string
  scopeLabel?: string
  selectedPath?: string | null
  treeTestId?: string
  workspace: WorkspaceTreeResponse | null
}

export function WorkspacePanelContent({
  error,
  emptyDescription = "agent-workspace has not been loaded yet.",
  emptyTitle = "Workspace unavailable",
  loadWorkspaceFile,
  loading,
  onRefresh,
  onSelectedPathChange,
  previewEmptyDescription = "Choose a workspace file to preview its Markdown.",
  previewEmptyTitle = "Select a file",
  scopePath,
  scopeLabel,
  selectedPath: selectedPathProp,
  treeTestId = "workspace-tree",
  workspace,
}: WorkspacePanelContentProps) {
  const [daytonaKey, setDaytonaKey] = useState<string>("")
  const [hasDaytonaKey, setHasDaytonaKey] = useState<boolean>(false)

  useEffect(() => {
    const key = localStorage.getItem("daytonaApiKey")
    if (key) {
      setHasDaytonaKey(true)
    }
  }, [])

  const handleSaveDaytonaKey = () => {
    if (daytonaKey.trim()) {
      localStorage.setItem("daytonaApiKey", daytonaKey.trim())
      setHasDaytonaKey(true)
      if (onRefresh) onRefresh()
    }
  }

  const handleClearDaytonaKey = () => {
    localStorage.removeItem("daytonaApiKey")
    setHasDaytonaKey(false)
    setDaytonaKey("")
    if (onRefresh) onRefresh()
  }

  const [internalSelectedPath, setInternalSelectedPath] = useState<
    string | null
  >(null)
  const isControlled = onSelectedPathChange !== undefined
  const selectedPath = isControlled
    ? (selectedPathProp ?? null)
    : internalSelectedPath
  const setSelectedPath = (path: string | null) => {
    if (isControlled) {
      onSelectedPathChange(path)
      return
    }
    setInternalSelectedPath(path)
  }
  const [preview, setPreview] = useState<WorkspaceFileResponse | null>(null)
  const [previewError, setPreviewError] = useState<Error | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const { handleTreeResizeStart, splitRef, splitStyle } =
    useWorkspaceSplitLayout(workspace)

  const scopedView = useMemo(() => {
    if (!workspace) {
      return {
        headerLabel: scopeLabel ?? "agent-workspace",
        nodes: [] as Array<WorkspaceTreeNode>,
      }
    }

    if (!scopePath) {
      return {
        headerLabel: workspace.root,
        nodes: workspace.nodes,
      }
    }

    const scopedNode = findWorkspaceNode(workspace.nodes, scopePath)
    if (!scopedNode) {
      return {
        headerLabel: scopeLabel ?? scopePath.split("/").pop() ?? scopePath,
        nodes: [] as Array<WorkspaceTreeNode>,
      }
    }

    if (scopedNode.type === "directory") {
      return {
        headerLabel: scopeLabel ?? scopedNode.name,
        nodes: scopedNode.children ?? [],
      }
    }

    return {
      headerLabel: scopeLabel ?? scopedNode.name,
      nodes: [scopedNode],
    }
  }, [scopeLabel, scopePath, workspace])

  useEffect(() => {
    if (!workspace || !selectedPath) return

    if (scopePath && !isPathWithinScope(selectedPath, scopePath)) {
      setSelectedPath(null)
      setPreview(null)
      setPreviewError(null)
      return
    }

    if (findWorkspaceNode(workspace.nodes, selectedPath)?.type === "file") {
      return
    }

    setSelectedPath(null)
    setPreview(null)
    setPreviewError(null)
  }, [onSelectedPathChange, scopePath, selectedPath, workspace])

  useEffect(() => {
    if (!selectedPath) return

    let cancelled = false
    async function loadPreview() {
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const body = await loadWorkspaceFile(selectedPath ?? "")
        if (!cancelled) setPreview(body)
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
  }, [loadWorkspaceFile, selectedPath, workspace])

  useEffect(() => {
    if (!selectedPath || typeof window === "undefined") return
    if (
      window.matchMedia(`(min-width: ${CHAT_PANEL_BREAKPOINT_PX}px)`).matches
    ) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: "auto",
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [selectedPath])

  if (error) {
    if (error.message.includes("daytona_credential_required")) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <HardDrive className="size-12 text-muted-foreground/50" />
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">Daytona Sandbox Required</h3>
            <p className="text-sm text-muted-foreground">
              To access the workspace, you need to provide a Daytona API key.
              This will provision your personal isolated environment.
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <input
              type="password"
              placeholder="Enter Daytona API Key"
              value={daytonaKey}
              onChange={(e) => setDaytonaKey(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveDaytonaKey()
              }}
            />
            <Button
              onClick={handleSaveDaytonaKey}
              disabled={!daytonaKey.trim()}
            >
              Connect Sandbox
            </Button>
          </div>
        </div>
      )
    }

    return (
      <ResourceNotice
        icon={CircleAlert}
        title="Unable to load workspace"
        description={error.message}
      />
    )
  }

  if (loading && !workspace) {
    return <WorkspaceSkeleton />
  }

  if (!workspace) {
    return (
      <ResourceNotice
        icon={HardDrive}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  if (scopePath && scopedView.nodes.length === 0) {
    return (
      <ResourceNotice
        icon={HardDrive}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div
      ref={splitRef}
      className={`relative grid h-full min-h-0 grid-cols-1 gap-2 overflow-hidden ${WORKSPACE_SPLIT_GAP_RESET}`}
      style={splitStyle}
    >
      {hasDaytonaKey && (
        <div className="absolute top-1 right-2 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearDaytonaKey}
            className="h-6 px-2 text-[10px]"
          >
            Disconnect Sandbox
          </Button>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div
          data-testid={treeTestId}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto"
        >
          <div className="mb-2 flex min-w-0 items-center gap-2 rounded-[6px] bg-foreground/5 px-2 py-1.5">
            <HardDrive className="size-3.5 shrink-0 text-foreground/45" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/70">
              {scopedView.headerLabel}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {scopedView.nodes.map((node) => (
              <WorkspaceNode
                key={node.path}
                node={node}
                onSelect={setSelectedPath}
                selectedPath={selectedPath}
              />
            ))}
          </div>
          {workspace.diagnostics.length > 0 && !scopePath && (
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
      </div>
      <button
        type="button"
        aria-label="Resize workspace tree"
        className={`min-h-0 cursor-col-resize touch-none bg-transparent transition-colors outline-none hover:bg-foreground/10 focus-visible:bg-foreground/10 ${WORKSPACE_SPLIT_HIDDEN_BLOCK}`}
        data-testid="workspace-tree-resize-handle"
        onPointerDown={handleTreeResizeStart}
      />
      <WorkspacePreview
        emptyDescription={previewEmptyDescription}
        emptyTitle={previewEmptyTitle}
        error={previewError}
        loading={previewLoading}
        preview={preview}
        previewRef={previewRef}
        selectedPath={selectedPath}
      />
    </div>
  )
}

function WorkspaceNode({
  node,
  onSelect,
  selectedPath,
}: {
  node: WorkspaceTreeNode
  onSelect: (path: string) => void
  selectedPath: string | null
}) {
  if (node.type === "directory") {
    return (
      <Collapsible>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="group w-full justify-start gap-1.5 text-left text-[12px] font-normal text-foreground/65 transition-none hover:bg-foreground/5 hover:text-foreground/80"
            />
          }
        >
          <ChevronRight className="size-3 shrink-0 text-foreground/35 transition-transform group-data-panel-open:rotate-90" />
          <Folder className="size-3.5 shrink-0 text-foreground/35" />
          <span className="min-w-0 flex-1 truncate" title={node.path}>
            {node.name}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-4">
          <div className="flex flex-col gap-0.5">
            {node.children?.map((child) => (
              <WorkspaceNode
                key={child.path}
                node={child}
                onSelect={onSelect}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const selected = node.path === selectedPath

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={selected}
      className={`w-full justify-start gap-1.5 text-[12px] font-normal transition-none ${
        selected
          ? "bg-foreground/8 text-foreground/80"
          : "text-foreground/65 hover:bg-foreground/5 hover:text-foreground/80"
      }`}
      title={node.path}
      onClick={() => onSelect(node.path)}
    >
      <File className="size-3.5 shrink-0 text-foreground/35" />
      <span className="min-w-0 flex-1 truncate text-left">{node.name}</span>
    </Button>
  )
}

function WorkspacePreview({
  emptyDescription,
  emptyTitle,
  error,
  loading,
  preview,
  previewRef,
  selectedPath,
}: {
  emptyDescription: string
  emptyTitle: string
  error: Error | null
  loading: boolean
  preview: WorkspaceFileResponse | null
  previewRef: RefObject<HTMLDivElement | null>
  selectedPath: string | null
}) {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[8px] border border-border/60 bg-background"
      data-testid="workspace-preview"
      ref={previewRef}
    >
      <div className="flex min-h-9 min-w-0 shrink-0 items-center gap-2 border-b border-border/60 px-2.5">
        <FileText className="size-3.5 shrink-0 text-foreground/35" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/70">
          {preview?.name ?? selectedPath ?? "Preview"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {!selectedPath && (
          <ResourceNotice
            icon={FileText}
            title={emptyTitle}
            description={emptyDescription}
          />
        )}
        {selectedPath && loading && <WorkspacePreviewSkeleton />}
        {selectedPath && error && (
          <ResourceNotice
            icon={CircleAlert}
            title="Unable to load preview"
            description={error.message}
          />
        )}
        {selectedPath &&
          !loading &&
          !error &&
          preview?.status === "too-large" && (
            <ResourceNotice
              icon={CircleAlert}
              title="Preview too large"
              description={`${preview.name} is too large to preview safely.`}
            />
          )}
        {selectedPath &&
          !loading &&
          !error &&
          preview?.status === "unsupported" && (
            <ResourceNotice
              icon={CircleAlert}
              title="Unsupported preview"
              description={`${preview.name} is not a supported text file.`}
            />
          )}
        {selectedPath &&
          !loading &&
          !error &&
          preview &&
          (preview.status === undefined || preview.status === "ok") && (
            <Markdown
              className="text-[12px] leading-relaxed"
              content={preview.content}
            />
          )}
      </div>
    </div>
  )
}
