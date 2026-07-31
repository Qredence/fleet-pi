import { useEffect, useRef } from "react"
import { planResourceInstallRefresh } from "./resource-install-refresh"
import type { ChatMessage } from "@workspace/pi-protocol/chat-types"
import type { WorkspaceTreeResponse } from "@workspace/pi-protocol/chat-protocol"

type UseResourceInstallRefreshArgs = {
  messages: Array<ChatMessage>
  refreshResources: () => void
  refreshWorkspace: () => void
  /** Clears the dedupe set whenever the session changes. */
  sessionId: string | undefined
  shouldLoadWorkspaceTree: boolean
  workspaceTree: WorkspaceTreeResponse | null
}

/**
 * Refreshes Pi Resources (and the workspace tree, when relevant) after a
 * `resource_install` tool call completes. Tool call ids are deduped per
 * session so repeats within or across turns do not refetch.
 */
export function useResourceInstallRefresh({
  messages,
  refreshResources,
  refreshWorkspace,
  sessionId,
  shouldLoadWorkspaceTree,
  workspaceTree,
}: UseResourceInstallRefreshArgs) {
  const handledResourceInstallToolCalls = useRef(new Set<string>())

  useEffect(() => {
    handledResourceInstallToolCalls.current.clear()
  }, [sessionId])

  useEffect(() => {
    const plan = planResourceInstallRefresh({
      handledToolCallIds: handledResourceInstallToolCalls.current,
      messages,
      shouldLoadWorkspaceTree,
      workspaceTree,
    })

    if (!plan) return

    plan.toolCallIds.forEach((toolCallId) => {
      handledResourceInstallToolCalls.current.add(toolCallId)
    })

    refreshResources()
    if (plan.shouldRefreshWorkspace) {
      refreshWorkspace()
    }
  }, [
    messages,
    refreshResources,
    refreshWorkspace,
    shouldLoadWorkspaceTree,
    workspaceTree,
  ])
}
