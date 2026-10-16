import { USER_VOLUME_ROOT } from "./project-trust"

export type MutationTier = "free" | "rationale-required" | "protected"

const FREELY_MUTABLE: Array<RegExp> = [
  /^scratch\//,
  /^artifacts\/traces\//,
  /^artifacts\/reports\//,
  /^memory\/daily\//,
]

const RATIONALE_REQUIRED: Array<RegExp> = [
  /^memory\/summaries\//,
  /^plans\//,
  /^memory\/project\//,
  /^memory\/research\//,
  /^skills\//,
  /^pi\/skills\//,
  /^pi\/prompts\//,
]

const PROTECTED: Array<RegExp> = [/^system\//, /^evals\//]

/**
 * Top-level `agent-workspace/` sections. Kept here so the CLI extension does
 * not import apps/web. Matches `WORKSPACE_TOP_LEVEL_SECTIONS`.
 */
const WORKSPACE_SECTION_ROOTS = new Set([
  "instructions",
  "system",
  "memory",
  "plans",
  "skills",
  "evals",
  "artifacts",
  "scratch",
  "pi",
  "indexes",
])

export type ClassifiedWorkspacePath =
  { scoped: false } | { scoped: true; relativePath: string; tier: MutationTier }

export function classifyTier(relativePath: string): MutationTier {
  if (matchesTier(FREELY_MUTABLE, relativePath)) return "free"
  if (matchesTier(RATIONALE_REQUIRED, relativePath)) return "rationale-required"
  if (matchesTier(PROTECTED, relativePath)) return "protected"
  return "rationale-required"
}

function matchesTier(patterns: Array<RegExp>, relativePath: string) {
  const asDirectory = relativePath.endsWith("/")
    ? relativePath
    : `${relativePath}/`
  return patterns.some(
    (pattern) => pattern.test(relativePath) || pattern.test(asDirectory)
  )
}

/**
 * Paths inside `agent-workspace/`, plus workspace-relative paths whose first
 * segments match the policy (`system/identity.md`, `scratch/note.md`).
 */
export function classifyToolPath(path: string): ClassifiedWorkspacePath {
  let normalized = path.replace(/\\/g, "/").replace(/^\.\//, "")
  const volumeRoot = USER_VOLUME_ROOT.replace(/\/+$/, "")
  if (normalized === volumeRoot) {
    return { scoped: false }
  }
  if (normalized.startsWith(`${volumeRoot}/`)) {
    normalized = normalized.slice(volumeRoot.length + 1)
  }
  const marker = "agent-workspace/"
  const index = normalized.lastIndexOf(marker)
  const relative =
    index >= 0 ? normalized.slice(index + marker.length) : normalized
  if (relative.startsWith("/")) return { scoped: false }

  const collapsed = normalizeWorkspaceRelative(relative)
  if (collapsed === null) return { scoped: false }
  if (index < 0 && !isWorkspaceRelative(collapsed)) return { scoped: false }
  return classifyInside(collapsed)
}

export function evaluateWorkspaceWrite(input: {
  displayPath: string
  relativePath: string
  rationale?: string
  override?: boolean
}): { ok: true; tier: MutationTier } | { ok: false; message: string } {
  const tier = classifyTier(input.relativePath)
  switch (tier) {
    case "protected":
      if (!input.override) {
        return {
          ok: false,
          message:
            `"${input.displayPath}" is in a protected area (system/**, evals/**). ` +
            "Set override:true only if this task explicitly concerns agent behavior or workspace design.",
        }
      }
      return { ok: true, tier }
    case "rationale-required":
      if (!input.rationale?.trim()) {
        return {
          ok: false,
          message: `"${input.displayPath}" requires a rationale. Provide a brief explanation of why this change is being made.`,
        }
      }
      return { ok: true, tier }
    case "free":
      return { ok: true, tier }
    default: {
      const _exhaustive: never = tier
      return _exhaustive
    }
  }
}

/** Raw `write` / `edit` have no rationale or override. Free workspace paths stay open. */
export function rawWorkspaceMutationBlock(path: string): string | undefined {
  const classified = classifyToolPath(path)
  if (!classified.scoped) return undefined
  switch (classified.tier) {
    case "free":
      return undefined
    case "protected":
      return (
        `"${classified.relativePath}" is protected (system/**, evals/**). ` +
        "Use workspace_write with override:true."
      )
    case "rationale-required":
      return `"${classified.relativePath}" requires workspace_write with a rationale.`
    default: {
      const _exhaustive: never = classified.tier
      return _exhaustive
    }
  }
}

function classifyInside(relativePath: string): ClassifiedWorkspacePath {
  if (!relativePath || relativePath.startsWith("/")) {
    return { scoped: false }
  }
  return {
    scoped: true,
    relativePath,
    tier: classifyTier(relativePath),
  }
}

function isWorkspaceRelative(relativePath: string) {
  const root = relativePath.split("/")[0] ?? ""
  return WORKSPACE_SECTION_ROOTS.has(root)
}

/** Collapse `.` and `..`. `null` means the path escaped above the workspace. */
function normalizeWorkspaceRelative(relativePath: string): string | null {
  const parts: Array<string> = []
  for (const segment of relativePath.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") {
      if (parts.length === 0) return null
      parts.pop()
      continue
    }
    parts.push(segment)
  }
  return parts.join("/")
}
