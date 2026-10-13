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

const KNOWN_WORKSPACE_ROOTS = [
  ...FREELY_MUTABLE,
  ...RATIONALE_REQUIRED,
  ...PROTECTED,
]

export type ClassifiedWorkspacePath =
  { scoped: false } | { scoped: true; relativePath: string; tier: MutationTier }

export function classifyTier(relativePath: string): MutationTier {
  if (FREELY_MUTABLE.some((pattern) => pattern.test(relativePath)))
    return "free"
  if (RATIONALE_REQUIRED.some((pattern) => pattern.test(relativePath))) {
    return "rationale-required"
  }
  if (PROTECTED.some((pattern) => pattern.test(relativePath)))
    return "protected"
  return "rationale-required"
}

/**
 * Paths inside `agent-workspace/`, plus workspace-relative paths whose first
 * segments match the policy (`system/identity.md`, `scratch/note.md`).
 */
export function classifyToolPath(path: string): ClassifiedWorkspacePath {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "")
  const marker = "agent-workspace/"
  const index = normalized.lastIndexOf(marker)
  if (index >= 0) {
    return classifyInside(normalized.slice(index + marker.length))
  }
  if (
    normalized.startsWith("/") ||
    normalized.includes("..") ||
    !KNOWN_WORKSPACE_ROOTS.some((pattern) => pattern.test(normalized))
  ) {
    return { scoped: false }
  }
  return classifyInside(normalized)
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
  if (
    !relativePath ||
    relativePath.startsWith("/") ||
    relativePath.startsWith("..")
  ) {
    return { scoped: false }
  }
  return {
    scoped: true,
    relativePath,
    tier: classifyTier(relativePath),
  }
}
