/**
 * Fleet Pi Project Trust Extension
 *
 * Handles project_trust events for workspace-native Pi resources.
 * Auto-approves known-safe paths and logs decisions for auditability.
 *
 * @see https://github.com/earendil-works/pi/blob/main/docs/extensions.md#project_trust
 */

import {
  decideHeadlessProjectTrust,
  isProtectedWorkspacePath,
} from "./lib/project-trust"
import type {
  ExtensionAPI,
  ExtensionContext,
  ProjectTrustContext,
  ProjectTrustEvent,
  ProjectTrustEventResult,
} from "@earendil-works/pi-coding-agent"

const WORKSPACE_NATIVE_PATHS = [
  "agent-workspace/pi/skills",
  "agent-workspace/pi/prompts",
  "agent-workspace/pi/extensions/enabled",
  "agent-workspace/pi/packages",
  ".pi/skills",
  ".pi/prompts",
]

function isWorkspaceNativePath(cwd: string): boolean {
  return WORKSPACE_NATIVE_PATHS.some((path) => cwd.includes(path))
}

export default function trustHandlerExtension(pi: ExtensionAPI) {
  pi.on(
    "project_trust",
    async (
      event: ProjectTrustEvent,
      ctx: ProjectTrustContext
    ): Promise<ProjectTrustEventResult> => {
      const { cwd } = event
      ctx.ui.notify(`Project trust check: ${cwd} (mode: ${ctx.mode})`, "info")
      return decideProjectTrust(cwd, ctx.mode, ctx)
    }
  )

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    ctx.ui.notify(
      `Trust handler active in ${ctx.cwd} (mode: ${ctx.mode})`,
      "info"
    )
  })
}

function decideProjectTrust(
  cwd: string,
  mode: ProjectTrustContext["mode"],
  ctx: ProjectTrustContext
): ProjectTrustEventResult {
  switch (mode) {
    case "print":
    case "json":
    case "rpc": {
      const trusted = decideHeadlessProjectTrust(cwd)
      return trusted === "yes"
        ? { trusted: "yes", remember: true }
        : { trusted: "no" }
    }
    case "tui":
      if (isWorkspaceNativePath(cwd)) {
        ctx.ui.notify(`Auto-approved workspace-native path: ${cwd}`, "info")
        return { trusted: "yes", remember: true }
      }
      if (isProtectedWorkspacePath(cwd)) {
        ctx.ui.notify(`Protected path requires confirmation: ${cwd}`, "warning")
        return { trusted: "undecided" }
      }
      return { trusted: "undecided" }
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}
