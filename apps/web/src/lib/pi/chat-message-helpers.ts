import type {
  ChatMessage,
  ChatToolPart,
} from "@workspace/ui/components/agent-elements/chat-types"

export function createTextMessage(
  role: ChatMessage["role"],
  text: string,
  id: string = crypto.randomUUID()
): ChatMessage {
  return {
    id,
    role,
    createdAt: Date.now(),
    parts: [{ type: "text", text }],
  }
}

export function appendAssistantDelta(
  messages: Array<ChatMessage>,
  assistantId: string,
  delta: string
) {
  return messages.map((message) => {
    if (message.id !== assistantId) return message
    const parts = [...message.parts]
    const textIndex = parts.findIndex((part) => part.type === "text")

    if (textIndex === -1) {
      return { ...message, parts: [...parts, { type: "text", text: delta }] }
    }

    const part = parts[textIndex]
    parts[textIndex] =
      part.type === "text" ? { ...part, text: `${part.text}${delta}` } : part
    return { ...message, parts }
  })
}

export function upsertAssistantToolPart(
  messages: Array<ChatMessage>,
  assistantId: string,
  toolPart: ChatToolPart
) {
  return messages.map((message) => {
    if (message.id !== assistantId) return message

    const toolIndex = message.parts.findIndex((part) => {
      return (
        part.type === toolPart.type &&
        "toolCallId" in part &&
        part.toolCallId === toolPart.toolCallId
      )
    })

    if (toolIndex === -1) {
      const textIndex = message.parts.findIndex((part) => part.type === "text")
      const parts =
        textIndex === -1
          ? [...message.parts, toolPart]
          : [
              ...message.parts.slice(0, textIndex),
              toolPart,
              ...message.parts.slice(textIndex),
            ]

      return { ...message, parts }
    }

    const parts = [...message.parts]
    parts[toolIndex] = { ...parts[toolIndex], ...toolPart }
    return { ...message, parts }
  })
}

export function upsertAssistantThinkingPart(
  messages: Array<ChatMessage>,
  assistantId: string,
  thought: string
) {
  return upsertAssistantToolPart(messages, assistantId, {
    type: "tool-Thinking",
    toolCallId: "thinking",
    state: "input-streaming",
    input: { thought },
    output: thought,
  })
}
