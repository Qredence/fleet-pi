import type { DesktopContext } from "@/lib/desktop/types"
import type { ChatSessionMetadata, ChatStreamEvent } from "./chat-protocol"
import { withDesktopHeaders } from "@/lib/desktop/client"

export async function fetchJson<T>(
  url: string,
  desktopContext?: DesktopContext,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, withDesktopHeaders(init, desktopContext))
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

export async function readChatStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void
) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Chat response did not include a stream")

  const decoder = new TextDecoder()
  let buffer = ""

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    onEvent(JSON.parse(trimmed) as ChatStreamEvent)
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIndex = buffer.indexOf("\n")
    while (newlineIndex >= 0) {
      handleLine(buffer.slice(0, newlineIndex))
      buffer = buffer.slice(newlineIndex + 1)
      newlineIndex = buffer.indexOf("\n")
    }
  }

  buffer += decoder.decode()
  handleLine(buffer)
}

export function metadataUrl(metadata: ChatSessionMetadata) {
  const params = new URLSearchParams()
  if (metadata.sessionFile) params.set("sessionFile", metadata.sessionFile)
  if (metadata.sessionId) params.set("sessionId", metadata.sessionId)
  return params.toString()
}

export function labelForState(state: ChatStreamEvent["type"] | string) {
  switch (state) {
    case "agent_start":
      return "Agent running"
    case "turn_start":
      return "Starting turn"
    case "message_start":
      return "Receiving response"
    case "message_end":
      return "Response received"
    case "turn_end":
      return "Turn finished"
    case "agent_end":
      return undefined
    default:
      return undefined
  }
}

export type QueueState = {
  steering: Array<string>
  followUp: Array<string>
}
