import { WorkspacePanelContent } from "./workspace-panel"
import type { WorkspacePanelContentProps } from "./workspace-panel"

const ARTIFACTS_SCOPE_SUFFIX = "artifacts"

export function getArtifactsScopePath(root: string) {
  return `${root}/${ARTIFACTS_SCOPE_SUFFIX}`
}

export function ArtifactsPanelContent({
  error,
  loadWorkspaceFile,
  loading,
  onSelectedPathChange,
  onRefresh,
  selectedPath,
  workspace,
}: Pick<
  WorkspacePanelContentProps,
  | "error"
  | "loadWorkspaceFile"
  | "loading"
  | "onSelectedPathChange"
  | "onRefresh"
  | "selectedPath"
  | "workspace"
>) {
  const scopePath = workspace
    ? getArtifactsScopePath(workspace.root)
    : undefined

  return (
    <WorkspacePanelContent
      emptyDescription="No artifacts folder was found under agent-workspace yet."
      emptyTitle="Artifacts unavailable"
      error={error}
      loadWorkspaceFile={loadWorkspaceFile}
      loading={loading}
      onSelectedPathChange={onSelectedPathChange}
      onRefresh={onRefresh}
      previewEmptyDescription="Choose a report, dataset, trace, or diagram to preview."
      previewEmptyTitle="Select an artifact"
      scopeLabel="artifacts"
      scopePath={scopePath}
      selectedPath={selectedPath}
      treeTestId="artifacts-tree"
      workspace={workspace}
    />
  )
}
