import {
  agentWorkspaceBashBlock,
  agentWorkspaceMutationBlock,
} from "../command-policy"
import { classifyToolPath } from "../../../../../../.pi/extensions/lib/mutation-tier"
import type { ChatMode } from "@workspace/pi-protocol/chat-protocol"

function hostedModes(name: string): ReadonlyArray<ChatMode> | undefined {
  switch (name) {
    case "read":
    case "search":
      return ["agent", "plan", "harness"]
    case "write":
    case "edit":
    case "bash":
    case "codemode":
    case "workspace_status":
      return ["agent", "harness"]
    default:
      return undefined
  }
}

export function hostedToolAllowed(name: string, mode: ChatMode): boolean {
  const modes = hostedModes(name)
  if (modes === undefined) return mode !== "plan"
  return modes.includes(mode)
}

function protectedWorkspacePath(path: string) {
  const classified = classifyToolPath(path)
  return classified.scoped && classified.tier === "protected"
}

export function hostedWriteBlock(
  mode: ChatMode,
  path: string,
  confirm: boolean | undefined
): string | undefined {
  if (mode === "harness" && protectedWorkspacePath(path)) {
    if (confirm === true) return undefined
    return "Confirmation required before a tool writes system/ or evals/."
  }
  return agentWorkspaceMutationBlock(path)
}

export function hostedBashBlock(
  mode: ChatMode,
  command: string,
  confirm: boolean | undefined
): string | undefined {
  if (mode === "harness" && confirm === true) {
    const block = agentWorkspaceBashBlock(command)
    if (block?.includes("protected")) return undefined
    return block
  }
  if (mode === "harness" && /(?:^|[\s"'`])(?:system|evals)\//.test(command)) {
    return "Confirmation required before a tool writes system/ or evals/."
  }
  return agentWorkspaceBashBlock(command)
}
