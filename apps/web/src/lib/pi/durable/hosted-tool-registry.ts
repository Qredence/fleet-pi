import {
  agentWorkspaceBashBlock,
  agentWorkspaceMutationBlock,
  evaluatePlanCommand,
} from "../command-policy"
import { classifyToolPath } from "../mutation-tier"
import { resolveHostedSandboxPath } from "./spike-daytona"
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

export function hostedPathBlock(path: string): string | undefined {
  try {
    resolveHostedSandboxPath(path)
    return undefined
  } catch (error) {
    return error instanceof Error
      ? error.message
      : `Sandbox path escapes workspace bound: ${path}`
  }
}

export function hostedWriteBlock(
  mode: ChatMode,
  path: string,
  confirm: boolean | undefined,
  rationale?: string
): string | undefined {
  const pathBlock = hostedPathBlock(path)
  if (pathBlock) return pathBlock
  if (mode === "harness" && protectedWorkspacePath(path)) {
    if (confirm === true) return undefined
    return "Confirmation required before a tool writes system/ or evals/."
  }
  return agentWorkspaceMutationBlock(path, rationale)
}

export function hostedBashBlock(
  mode: ChatMode,
  command: string,
  confirm: boolean | undefined
): string | undefined {
  if (mode === "plan") {
    const planResult = evaluatePlanCommand(command)
    if (!planResult.allowed) {
      return planResult.reason ?? "Command is not read-only."
    }
  }
  const block = agentWorkspaceBashBlock(command)
  if (mode === "harness") {
    const touchesProtected =
      block?.includes("protected") ||
      /(?:^|[\s"'`])(?:system|evals)\//.test(command)
    if (touchesProtected) {
      if (confirm === true) return undefined
      return "Confirmation required before a tool writes system/ or evals/."
    }
  }
  return block
}
