import {
  CircleAlert,
  File,
  FileText,
  Folder,
  HardDrive,
  RefreshCw,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Markdown } from "@workspace/ui/components/agent-elements/markdown"
import {
  ResourceChipSection,
  ResourceNotice,
  findWorkspaceNode,
} from "./shared"
import type {
  WorkspaceFileResponse,
  WorkspaceTreeNode,
  WorkspaceTreeResponse,
} from "@/lib/pi/chat-protocol"

export function WorkspacePanelContent({
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
