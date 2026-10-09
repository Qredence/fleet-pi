export type WorkspacePanelTarget = {
  panel: "artifacts" | "workspace"
  path: string
}

const WORKSPACE_ROOT = "agent-workspace"
const ARTIFACTS_SEGMENT = `${WORKSPACE_ROOT}/artifacts`

export const WORKSPACE_ARTIFACTS_SCOPE = ARTIFACTS_SEGMENT

function collapseWorkspaceSegments(path: string): string {
  const stack: Array<string> = []
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue
    if (segment === "..") {
      stack.pop()
      continue
    }
    stack.push(segment)
  }
  return stack.join("/")
}

export function isPathWithinScope(
  path: string,
  scopePath: string | null | undefined
): boolean {
  if (!scopePath) return true
  return path === scopePath || path.startsWith(`${scopePath}/`)
}

function stripSandboxPrefixes(filePath: string): string {
  const prefixes = [
    "/project/sandbox/repo/",
    "/project/sandbox/",
    "/project/",
    "/workspace/",
  ]
  for (const prefix of prefixes) {
    if (filePath.startsWith(prefix)) return filePath.slice(prefix.length)
  }

  return stripWorktreePrefix(filePath) ?? filePath
}

const WORKTREE_MARKER = ".21st/worktrees/"

/**
 * Returns the path after `.21st/worktrees/<a>/<b>/`, or null when absent.
 * Linear-time replacement for `/\.21st\/worktrees\/[^/]+\/[^/]+\/(.+)$/`,
 * which CodeQL flagged as polynomial ReDoS (js/polynomial-redos).
 */
export function stripWorktreePrefix(filePath: string): string | null {
  // `.` in the old pattern does not match line terminators, so the captured
  // tail must start after the last one.
  const lastLineBreak = Math.max(
    filePath.lastIndexOf("\n"),
    filePath.lastIndexOf("\r"),
    filePath.lastIndexOf("\u2028"),
    filePath.lastIndexOf("\u2029")
  )
  let from = 0
  for (;;) {
    const markerIndex = filePath.indexOf(WORKTREE_MARKER, from)
    if (markerIndex === -1) return null
    const start = markerIndex + WORKTREE_MARKER.length
    const firstSlash = filePath.indexOf("/", start)
    if (firstSlash > start) {
      const secondSlash = filePath.indexOf("/", firstSlash + 1)
      if (
        secondSlash > firstSlash + 1 &&
        secondSlash < filePath.length - 1 &&
        lastLineBreak <= secondSlash
      ) {
        return filePath.slice(secondSlash + 1)
      }
    }
    from = markerIndex + 1
  }
}

function findWorkspaceRootIndex(segments: Array<string>): number {
  return segments.findIndex((segment) => segment === WORKSPACE_ROOT)
}

export function normalizeWorkspaceFilePath(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const stripped = stripSandboxPrefixes(trimmed)
  const normalized = stripped.replace(/\\/g, "/").replace(/\/+/g, "/")

  if (normalized.startsWith(`${WORKSPACE_ROOT}/`)) {
    const collapsed = collapseWorkspaceSegments(normalized)
    return collapsed.startsWith(`${WORKSPACE_ROOT}/`) ? collapsed : null
  }

  if (normalized === WORKSPACE_ROOT) {
    return null
  }

  if (normalized.startsWith("artifacts/")) {
    return `${WORKSPACE_ROOT}/${normalized}`
  }

  if (normalized.startsWith("/")) {
    const segments = normalized.split("/").filter(Boolean)
    const rootIndex = findWorkspaceRootIndex(segments)
    if (rootIndex >= 0) {
      return segments.slice(rootIndex).join("/")
    }
    return null
  }

  return null
}

export function resolveWorkspacePanelTarget(
  rawPath: string
): WorkspacePanelTarget | null {
  const path = normalizeWorkspaceFilePath(rawPath)
  if (!path) return null

  if (path.startsWith(`${ARTIFACTS_SEGMENT}/`) || path === ARTIFACTS_SEGMENT) {
    return { panel: "artifacts", path }
  }

  return { panel: "workspace", path }
}

export function extractWorkspaceFilePathFromToolInput(
  input: Record<string, unknown> | undefined
): string | null {
  if (!input) return null

  const filePath =
    typeof input.file_path === "string"
      ? input.file_path
      : typeof input.path === "string"
        ? input.path
        : null

  return filePath
}

export function resolveWorkspacePathFromToolInput(
  input: Record<string, unknown> | undefined
): WorkspacePanelTarget | null {
  const raw = extractWorkspaceFilePathFromToolInput(input)
  return raw ? resolveWorkspacePanelTarget(raw) : null
}
