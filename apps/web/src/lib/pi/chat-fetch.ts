import { ChatStreamEventSchema } from "./chat-protocol.zod"
import type { ZodType } from "zod"
import type { ChatSessionMetadata, ChatStreamEvent } from "./chat-protocol"

export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

export async function fetchValidatedJson<T>(
  url: string,
  schema: ZodType<T>,
  init?: RequestInit
): Promise<T> {
  const data = await fetchJson<unknown>(url, init)
  return parseWithSchema(schema, data, `Response from ${url}`)
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
    const data = JSON.parse(trimmed) as unknown
    onEvent(parseWithSchema(ChatStreamEventSchema, data, "Chat stream event"))
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

export function parseWithSchema<T>(
  schema: ZodType<T>,
  data: unknown,
  label: string
): T {
  const parsed = schema.safeParse(data)
  if (parsed.success) return parsed.data

  throw new Error(`${label} did not match the expected contract`)
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
