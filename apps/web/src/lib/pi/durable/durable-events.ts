import type { ChatStreamEvent } from "@workspace/pi-protocol/chat-protocol"
import type {
  ChatMessage,
  ChatToolPart,
} from "@workspace/pi-protocol/chat-types"

type ViewEntry = {
  id: string | number
  model?: ReadonlyArray<ViewMessage>
}

type ViewMessage = {
  role?: string
  content?: unknown
  toolCallId?: string
  toolName?: string
  isError?: boolean
}

export type DurableConversationSnapshot = {
  entries: ReadonlyArray<ViewEntry>
  docs?: Readonly<Record<string, unknown>>
}

type ToolSnapshot = {
  name: string
  state: "input-available" | "output-available" | "output-error"
  input?: unknown
  output?: unknown
}

export type DurableViewDiff = {
  textByKey: Map<string, string>
  tools: Map<string, ToolSnapshot>
  liveText: string
}

export function createDurableViewDiff(): DurableViewDiff {
  return {
    textByKey: new Map(),
    tools: new Map(),
    liveText: "",
  }
}

export function eventsFromConversationView(
  view: DurableConversationSnapshot,
  diff: DurableViewDiff
): Array<ChatStreamEvent> {
  const events: Array<ChatStreamEvent> = []
  for (const entry of view.entries) {
    collectEntry(String(entry.id), entry.model, diff, events)
  }
  const live = liveAssistantMessage(view.docs)
  if (live) collectEntry("live", [live], diff, events)
  return events
}

export function messagesFromEntries(
  entries: ReadonlyArray<ViewEntry>
): Array<ChatMessage> {
  const messages: Array<ChatMessage> = []
  for (const entry of entries) {
    const model = entry.model ?? []
    for (const message of model) {
      if (message.role === "user") {
        const text = textFromContent(message.content)
        if (!text) continue
        messages.push({
          id: `user-${String(entry.id)}`,
          role: "user",
          parts: [{ type: "text", text }],
        })
        continue
      }
      if (message.role === "toolResult") {
        applyToolResult(messages, message)
        continue
      }
      const text = textFromContent(message.content)
      const tools = toolCallsFromContent(message.content)
      if (!text && tools.length === 0) continue
      messages.push({
        id: `assistant-${String(entry.id)}`,
        role: "assistant",
        parts: [
          ...(text ? [{ type: "text" as const, text }] : []),
          ...tools.map((tool) =>
            toolPart({
              id: tool.id,
              name: tool.name,
              state: "input-available",
              input: tool.input,
            })
          ),
        ],
      })
    }
  }
  return messages
}

export function assistantMessageFromDiff(
  diff: DurableViewDiff,
  messageId: string
): ChatMessage {
  let text = ""
  for (const [key, value] of diff.textByKey) {
    if (key === "live") continue
    text += value
  }
  if (!text && diff.liveText) text = diff.liveText
  const parts: ChatMessage["parts"] = []
  if (text) parts.push({ type: "text", text })
  for (const [toolCallId, tool] of diff.tools) {
    parts.push(toolPart({ ...tool, id: toolCallId }))
  }
  return { id: messageId, role: "assistant", parts }
}

function collectEntry(
  key: string,
  model: ReadonlyArray<ViewMessage> | undefined,
  diff: DurableViewDiff,
  events: Array<ChatStreamEvent>
) {
  if (!model) return
  for (const message of model) {
    if (message.role === "toolResult") {
      const toolCallId = message.toolCallId
      if (!toolCallId) continue
      const name = message.toolName ?? "tool"
      const output = textFromContent(message.content)
      const state = message.isError ? "output-error" : "output-available"
      pushTool(diff, events, {
        id: toolCallId,
        name,
        state,
        output,
        input: diff.tools.get(toolCallId)?.input,
      })
      continue
    }
    const text = textFromContent(message.content)
    if (text) pushText(diff, events, key, text)
    for (const tool of toolCallsFromContent(message.content)) {
      pushTool(diff, events, {
        id: tool.id,
        name: tool.name,
        state: "input-available",
        input: tool.input,
      })
    }
  }
}

function pushText(
  diff: DurableViewDiff,
  events: Array<ChatStreamEvent>,
  key: string,
  text: string
) {
  if (key !== "live" && diff.liveText && text.startsWith(diff.liveText)) {
    if (!diff.textByKey.has(key)) diff.textByKey.set(key, diff.liveText)
    diff.liveText = ""
  }
  const previous = diff.textByKey.get(key) ?? ""
  if (text.length <= previous.length || !text.startsWith(previous)) {
    diff.textByKey.set(key, text)
    return
  }
  const suffix = text.slice(previous.length)
  diff.textByKey.set(key, text)
  if (key === "live") diff.liveText = text
  events.push({ type: "delta", text: suffix, messageId: key })
}

function pushTool(
  diff: DurableViewDiff,
  events: Array<ChatStreamEvent>,
  tool: ToolSnapshot & { id: string }
) {
  const previous = diff.tools.get(tool.id)
  const next: ToolSnapshot = {
    name: tool.name,
    state: tool.state,
    input: tool.input ?? previous?.input,
    output: tool.output ?? previous?.output,
  }
  if (
    previous &&
    previous.state === next.state &&
    previous.output === next.output &&
    previous.input === next.input
  ) {
    return
  }
  diff.tools.set(tool.id, next)
  events.push({ type: "tool", part: toolPart({ ...next, id: tool.id }) })
}

function toolPart(tool: ToolSnapshot & { id: string }): ChatToolPart {
  return {
    type: `tool-${normalizeDurableToolName(tool.name)}`,
    toolCallId: tool.id,
    state: tool.state,
    input: tool.input,
    ...(tool.output === undefined ? {} : { output: tool.output }),
  }
}

export function normalizeDurableToolName(toolName: string) {
  switch (toolName.toLowerCase()) {
    case "read":
      return "Read"
    case "write":
      return "Write"
    case "edit":
      return "Edit"
    case "bash":
      return "Bash"
    default:
      return toolName
  }
}

function liveAssistantMessage(
  docs: Readonly<Record<string, unknown>> | undefined
): ViewMessage | undefined {
  const live = docs?.["pi.live"]
  if (!live || typeof live !== "object") return undefined
  const generation = (live as { generation?: { message?: ViewMessage } })
    .generation
  const message = generation?.message
  if (!message || typeof message !== "object") return undefined
  return message
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return ""
      if ("type" in part && part.type === "text" && "text" in part) {
        return typeof part.text === "string" ? part.text : ""
      }
      return ""
    })
    .join("")
}

function toolCallsFromContent(content: unknown): Array<{
  id: string
  name: string
  input: unknown
}> {
  if (!Array.isArray(content)) return []
  const calls: Array<{ id: string; name: string; input: unknown }> = []
  for (const part of content) {
    if (!part || typeof part !== "object") continue
    if (!("type" in part) || part.type !== "toolCall") continue
    const id = "id" in part && typeof part.id === "string" ? part.id : ""
    const name =
      "name" in part && typeof part.name === "string" ? part.name : ""
    if (!id || !name) continue
    calls.push({
      id,
      name,
      input: "arguments" in part ? part.arguments : undefined,
    })
  }
  return calls
}

function isToolPart(part: ChatMessage["parts"][number]): part is ChatToolPart {
  return part.type !== "text" && part.type !== "error"
}

function applyToolResult(messages: Array<ChatMessage>, message: ViewMessage) {
  const toolCallId = message.toolCallId
  if (!toolCallId) return
  const output = textFromContent(message.content)
  const state = message.isError ? "output-error" : "output-available"
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index]
    if (candidate.role !== "assistant") continue
    const part = candidate.parts.find(
      (item) => isToolPart(item) && item.toolCallId === toolCallId
    )
    if (!part || !isToolPart(part)) continue
    part.state = state
    part.output = output
    return
  }
}
