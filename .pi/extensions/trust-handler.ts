/**
 * Fleet Pi Project Trust Extension
 *
 * Handles project_trust events for workspace-native Pi resources.
 * Auto-approves known-safe paths and logs decisions for auditability.
 *
 * @see https://github.com/earendil-works/pi/blob/main/docs/extensions.md#project_trust
 */

import type {
  ExtensionAPI,
  ProjectTrustEvent,
  ProjectTrustEventResult,
  ProjectTrustContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent"

// Paths that are considered workspace-native and safe
const WORKSPACE_NATIVE_PATHS = [
  "agent-workspace/pi/skills",
  "agent-workspace/pi/prompts",
  "agent-workspace/pi/extensions/enabled",
  "agent-workspace/pi/packages",
  ".pi/skills",
  ".pi/prompts",
]

// Protected paths that require explicit confirmation
const PROTECTED_PATHS = ["agent-workspace/system", "agent-workspace/evals"]

/**
 * Check if a path is workspace-native (safe to auto-approve)
 */
function isWorkspaceNativePath(cwd: string): boolean {
  return WORKSPACE_NATIVE_PATHS.some((path) => cwd.includes(path))
}

/**
 * Check if a path is protected (requires explicit confirmation)
 */
function isProtectedPath(cwd: string): boolean {
  return PROTECTED_PATHS.some((path) => cwd.includes(path))
}

export default function trustHandlerExtension(pi: ExtensionAPI) {
  pi.on(
    "project_trust",
    async (
      event: ProjectTrustEvent,
      ctx: ProjectTrustContext
    ): Promise<ProjectTrustEventResult> => {
      const { cwd } = event
      const { mode } = ctx

      // Log the trust check for auditability
      ctx.ui.notify(`Project trust check: ${cwd} (mode: ${mode})`, "info")

      // In RPC/JSON/print mode, let the built-in handler decide
      if (mode !== "tui") {
        return { trusted: "undecided" }
      }

      // Auto-approve workspace-native paths
      if (isWorkspaceNativePath(cwd)) {
        ctx.ui.notify(`Auto-approved workspace-native path: ${cwd}`, "info")
        return { trusted: "yes", remember: true }
      }

      // Require explicit confirmation for protected paths
      if (isProtectedPath(cwd)) {
        ctx.ui.notify(`Protected path requires confirmation: ${cwd}`, "warning")
        return { trusted: "undecided" }
      }

      // Default: let built-in handler decide
      return { trusted: "undecided" }
    }
  )

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    ctx.ui.notify(
      `Trust handler active in ${ctx.cwd} (mode: ${ctx.mode})`,
      "info"
    )
  })
}
