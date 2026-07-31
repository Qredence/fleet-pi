import type { ChatMessage } from "@workspace/pi-protocol/chat-types"
import type { WorkspaceTreeResponse } from "@workspace/pi-protocol/chat-protocol"

export type ResourceInstallRefreshPlan = {
  shouldRefreshWorkspace: boolean
  toolCallIds: Array<string>
}

/**
 * Pure decision for the resource-install refresh effect: which install tool
 * calls are new since the last run, and whether the workspace tree needs a
 * refresh. Returns null when nothing unhandled completed (no refresh).
 */
export function planResourceInstallRefresh({
  handledToolCallIds,
  messages,
  shouldLoadWorkspaceTree,
  workspaceTree,
}: {
  handledToolCallIds: ReadonlySet<string>
  messages: Array<ChatMessage>
  shouldLoadWorkspaceTree: boolean
  workspaceTree: WorkspaceTreeResponse | null
}): ResourceInstallRefreshPlan | null {
  const toolCallIds = collectCompletedResourceInstallToolCallIds(
    messages
  ).filter((toolCallId) => !handledToolCallIds.has(toolCallId))

  if (toolCallIds.length === 0) return null

  return {
    shouldRefreshWorkspace: workspaceTree !== null || shouldLoadWorkspaceTree,
    toolCallIds,
  }
}

export function collectCompletedResourceInstallToolCallIds(
  messages: Array<ChatMessage>
) {
  const completed = new Set<string>()

  for (const message of messages) {
    if (message.role !== "assistant") continue

    for (const part of message.parts) {
      if (
        part.type !== "tool-resource_install" ||
        part.state !== "output-available" ||
        typeof part.toolCallId !== "string" ||
        !hasInstalledPath(part.output)
      ) {
        continue
      }

      completed.add(part.toolCallId)
    }
  }

  return [...completed]
}

function hasInstalledPath(output: unknown) {
  if (!output || typeof output !== "object") return false
  const details =
    "details" in output && output.details && typeof output.details === "object"
      ? (output.details as Record<string, unknown>)
      : undefined

  return typeof details?.installedPath === "string"
}
