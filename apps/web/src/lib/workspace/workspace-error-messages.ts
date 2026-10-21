const SAFE_WORKSPACE_ERROR_MESSAGES = new Set([
  "daytona_credential_required",
  "Workspace is unavailable.",
  "Workspace query failed.",
  "Workspace operation failed.",
  "Workspace projection is unavailable.",
  "Workspace projection is unavailable for reindex.",
  "Workspace projection is degraded.",
  "Workspace reindex failed.",
  "Missing workspace item id.",
  "Workspace item was not found.",
  "Missing workspace search query.",
  "Missing workspace file path.",
  "Workspace file path must be project-relative.",
  "Workspace file path is outside agent-workspace.",
  "Workspace path is not a file.",
  "Workspace path is a directory. Provide a path to a specific file.",
  "Workspace file was not found.",
  "Permission denied accessing workspace file.",
  "Workspace file path validation failed.",
  "Failed to access workspace file.",
  "Failed to resolve workspace file.",
])

export function getSafeWorkspaceErrorMessage(message: string): string {
  return SAFE_WORKSPACE_ERROR_MESSAGES.has(message)
    ? message
    : "Workspace operation failed."
}
