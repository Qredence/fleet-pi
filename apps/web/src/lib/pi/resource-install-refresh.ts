import type { ChatMessage } from "@workspace/ui/components/agent-elements/chat-types"

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
