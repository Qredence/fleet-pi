import type {
  ChatMessage,
  ChatToolPart,
} from "@workspace/ui/components/agent-elements/chat-types"
import type {
  AgentSessionEvent,
  SessionEntry,
} from "@mariozechner/pi-coding-agent"

export function toToolPart(
  event: Extract<
    AgentSessionEvent,
    {
      type:
        | "tool_execution_start"
        | "tool_execution_update"
        | "tool_execution_end"
    }
  >,
  fallbackInput?: Record<string, unknown>
): ChatToolPart {
  const toolName = normalizeToolName(event.toolName)
  const input = normalizeToolInput(
    toolName,
    "args" in event ? event.args : (fallbackInput ?? {})
  )
  const rawOutput =
    event.type === "tool_execution_update"
      ? event.partialResult
      : event.type === "tool_execution_end"
        ? event.result
        : undefined
  const isError = event.type === "tool_execution_end" ? event.isError : false

  return {
    type: `tool-${toolName}`,
    toolCallId: event.toolCallId,
    state:
      event.type === "tool_execution_start"
        ? "input-available"
        : event.type === "tool_execution_update"
          ? "input-available"
          : isError
            ? "output-error"
            : "output-available",
    input,
    ...(rawOutput === undefined
      ? {}
      : { output: normalizeToolOutput(toolName, input, rawOutput, isError) }),
  }
}

export function toChatMessage(
  id: string,
  role: ChatMessage["role"],
  parts: Array<ChatToolPart>,
  createdAt: number = Date.now()
): ChatMessage {
  return {
    id,
    role,
    createdAt,
    parts: parts.length > 0 ? parts : [{ type: "text", text: "" }],
  }
}

export function upsertToolPart(parts: Array<ChatToolPart>, part: ChatToolPart) {
  const index = parts.findIndex(
    (current) =>
      current.type === part.type &&
      "toolCallId" in current &&
      current.toolCallId === part.toolCallId
  )

  if (index === -1) {
    const textIndex = parts.findIndex((current) => current.type === "text")
    if (textIndex === -1) return [...parts, part]

    return [...parts.slice(0, textIndex), part, ...parts.slice(textIndex)]
  }

  const next = [...parts]
  next[index] = { ...next[index], ...part }
  return next
}

export function appendTextPart(parts: Array<ChatToolPart>, delta: string) {
  const index = parts.findIndex((part) => part.type === "text")
  if (index === -1) return [...parts, { type: "text", text: delta }]

  const next = [...parts]
  const part = next[index]
  next[index] =
    part.type === "text" ? { ...part, text: `${part.text}${delta}` } : part
  return next
}

export function upsertThinkingPart(
  parts: Array<ChatToolPart>,
  text: string,
  toolCallId = "thinking"
) {
  return upsertToolPart(parts, {
    type: "tool-Thinking",
    toolCallId,
    state: "input-streaming",
    input: { thought: text },
    output: text,
  })
}

export function normalizeToolName(toolName: string) {
  switch (toolName.toLowerCase()) {
    case "read":
      return "Read"
    case "write":
      return "Write"
    case "edit":
      return "Edit"
    case "bash":
      return "Bash"
    case "questionnaire":
    case "question":
      return "Question"
    default:
      return toolName
  }
}

export function textFromToolResult(result: unknown) {
  if (!result || typeof result !== "object") return ""
  const content = (result as { content?: unknown }).content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) => {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text"
      ) {
        const text = (part as { text?: unknown }).text
        return typeof text === "string" ? text : ""
      }
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

export function normalizeToolInput(toolName: string, args: unknown) {
  const input =
    args && typeof args === "object"
      ? { ...(args as Record<string, unknown>) }
      : {}

  if (typeof input.path === "string" && !input.file_path) {
    input.file_path = input.path
  }

  if (toolName === "Edit" && Array.isArray(input.edits)) {
    const edits = input.edits as Array<Record<string, unknown>>
    input.old_string = edits
      .map((edit) => (typeof edit.oldText === "string" ? edit.oldText : ""))
      .join("\n")
    input.new_string = edits
      .map((edit) => (typeof edit.newText === "string" ? edit.newText : ""))
      .join("\n")
  }

  return input
}

export function normalizeToolOutput(
  toolName: string,
  input: Record<string, unknown>,
  result: unknown,
  isError = false
) {
  const text = textFromToolResult(result)

  // Safely extract details with proper type validation
  let details: Record<string, unknown> = {}
  if (result && typeof result === "object") {
    const resultObj = result as Record<string, unknown>
    if (
      "details" in resultObj &&
      resultObj.details !== null &&
      typeof resultObj.details === "object"
    ) {
      details = resultObj.details as Record<string, unknown>
    }
  }

  if (toolName === "Bash") {
    return {
      output: text,
      stdout: text,
      exitCode: isError ? 1 : 0,
      details,
    }
  }

  if (toolName === "Write") {
    return {
      content: typeof input.content === "string" ? input.content : text,
      details,
    }
  }

  if (toolName === "Edit") {
    let diff: string | undefined
    if ("diff" in details && typeof details.diff === "string") {
      diff = details.diff
    }

    return {
      content: typeof input.new_string === "string" ? input.new_string : text,
      old_content: typeof input.old_string === "string" ? input.old_string : "",
      diff,
      details,
    }
  }

  return {
    content: text,
    details,
  }
}

export function sessionEntriesToChatMessages(entries: Array<SessionEntry>) {
  const messages: Array<ChatMessage> = []
  const toolTargets = new Map<
    string,
    { message: ChatMessage; toolName: string; input: Record<string, unknown> }
  >()

  for (const entry of entries) {
    if (entry.type !== "message") continue
    const message = entry.message

    if (isUserMessage(message)) {
      messages.push({
        id: entry.id,
        role: "user",
        createdAt: message.timestamp,
        parts: [
          { type: "text", text: textFromMessageContent(message.content) },
        ],
      })
      continue
    }

    if (isAssistantMessage(message)) {
      const parts: Array<ChatToolPart> = []
      message.content.forEach((content, index) => {
        if (content.type === "text") {
          parts.push({ type: "text", text: content.text })
          return
        }

        if (content.type === "thinking") {
          parts.push({
            type: "tool-Thinking",
            toolCallId: `${entry.id}-thinking-${index}`,
            state: "output-available",
            input: { thought: content.thinking },
            output: content.thinking,
          })
          return
        }

        const toolName = normalizeToolName(content.name)
        const input = normalizeToolInput(toolName, content.arguments)
        const part: ChatToolPart = {
          type: `tool-${toolName}`,
          toolCallId: content.id,
          state: "input-available",
          input,
        }
        parts.push(part)
      })

      const chatMessage = toChatMessage(
        entry.id,
        "assistant",
        parts,
        message.timestamp
      )
      messages.push(chatMessage)

      for (const part of parts) {
        if (
          "toolCallId" in part &&
          typeof part.toolCallId === "string" &&
          part.type.startsWith("tool-")
        ) {
          toolTargets.set(part.toolCallId, {
            message: chatMessage,
            toolName: part.type.slice("tool-".length),
            input:
              part.input && typeof part.input === "object"
                ? (part.input as Record<string, unknown>)
                : {},
          })
        }
      }
      continue
    }

    if (isToolResultMessage(message)) {
      const target = toolTargets.get(message.toolCallId)
      const toolName = normalizeToolName(message.toolName)
      const input = target?.input ?? {}
      const part: ChatToolPart = {
        type: `tool-${toolName}`,
        toolCallId: message.toolCallId,
        state: message.isError ? "output-error" : "output-available",
        input,
        output: normalizeToolOutput(toolName, input, message, message.isError),
      }

      if (target) {
        target.message.parts = upsertToolPart(target.message.parts, part)
      } else {
        messages.push(
          toChatMessage(entry.id, "assistant", [part], message.timestamp)
        )
      }
    }
  }

  return messages
}

function isUserMessage(
  message: SessionAgentMessage
): message is Extract<SessionAgentMessage, { role: "user" }> {
  return isMessageWithRole(message, "user")
}

function isAssistantMessage(
  message: SessionAgentMessage
): message is Extract<SessionAgentMessage, { role: "assistant" }> {
  return isMessageWithRole(message, "assistant")
}

function isToolResultMessage(
  message: SessionAgentMessage
): message is Extract<SessionAgentMessage, { role: "toolResult" }> {
  return isMessageWithRole(message, "toolResult")
}

function isMessageWithRole(message: SessionAgentMessage, role: string) {
  return "role" in message && message.role === role
}

function textFromMessageContent(content: unknown) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map((part) => {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text
      }
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

type SessionAgentMessage = Extract<SessionEntry, { type: "message" }>["message"]
