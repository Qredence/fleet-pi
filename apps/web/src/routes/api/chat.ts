import { createFileRoute } from "@tanstack/react-router"
import { getModels, stream } from "@mariozechner/pi-ai"
import type { AssistantMessage, Context, Message } from "@mariozechner/pi-ai"
import type { ChatMessage } from "@workspace/ui/components/agent-elements/chat-types"

type ChatRequest = {
  id?: string
  messages?: Array<ChatMessage>
  model?: string
}

type ChatStreamEvent =
  | { type: "start"; id: string }
  | { type: "delta"; text: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; message: string }

const DEFAULT_BEDROCK_MODEL = "anthropic.claude-sonnet-4-6"
const BEDROCK_MODELS = getModels("amazon-bedrock")
const ZERO_USAGE: AssistantMessage["usage"] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
}

function getText(message: ChatMessage) {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => {
      return part.type === "text" && typeof part.text === "string"
    })
    .map((part) => part.text)
    .join("")
}

function getTimestamp(message: ChatMessage) {
  const createdAt = message.createdAt
  if (typeof createdAt === "number") return createdAt
  if (typeof createdAt === "string") {
    const parsed = Date.parse(createdAt)
    if (!Number.isNaN(parsed)) return parsed
  }
  if (createdAt instanceof Date) return createdAt.getTime()
  return Date.now()
}

function normalizeBedrockModelId(modelId?: string) {
  const selected =
    modelId ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_BEDROCK_MODEL
  const withoutRegionPrefix = selected.replace(/^us\./, "")
  const withoutSuffix = selected.replace(/\[[^\]]+\]$/, "")
  const normalized = withoutRegionPrefix.replace(/\[[^\]]+\]$/, "")
  const candidates = [selected, withoutSuffix, withoutRegionPrefix, normalized]

  return (
    candidates
      .map((candidate) =>
        BEDROCK_MODELS.find((model) => model.id === candidate),
      )
      .find((model) => model !== undefined) ??
    BEDROCK_MODELS.find((model) => model.id === DEFAULT_BEDROCK_MODEL) ??
    BEDROCK_MODELS[0]
  )
}

function toPiMessage(message: ChatMessage, modelId: string): Message | null {
  const text = getText(message)
  if (!text.trim()) return null

  if (message.role === "user") {
    return {
      role: "user",
      content: text,
      timestamp: getTimestamp(message),
    }
  }

  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "bedrock-converse-stream",
    provider: "amazon-bedrock",
    model: modelId,
    usage: ZERO_USAGE,
    stopReason: "stop",
    timestamp: getTimestamp(message),
  }
}

function toContext(messages: Array<ChatMessage>, modelId: string): Context {
  return {
    messages: messages
      .map((message) => toPiMessage(message, modelId))
      .filter((message): message is Message => Boolean(message)),
  }
}

function toChatMessage(id: string, message: AssistantMessage): ChatMessage {
  const text = message.content
    .filter((part): part is { type: "text"; text: string } => {
      return part.type === "text" && typeof part.text === "string"
    })
    .map((part) => part.text)
    .join("")

  return {
    id,
    role: "assistant",
    createdAt: message.timestamp,
    parts: [{ type: "text", text }],
  }
}

function encodeEvent(event: ChatStreamEvent) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequest
        const messages = Array.isArray(body.messages) ? body.messages : []
        const assistantId = crypto.randomUUID()
        const model = normalizeBedrockModelId(body.model)

        const context = toContext(messages, model.id)

        const readable = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: ChatStreamEvent) => {
              controller.enqueue(encodeEvent(event))
            }

            try {
              send({ type: "start", id: assistantId })

              const result = stream(model, context, {
                region: process.env.AWS_REGION ?? "us-east-1",
                profile: process.env.AWS_PROFILE,
                bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK,
                signal: request.signal,
              })

              for await (const event of result) {
                if (event.type === "text_delta") {
                  send({ type: "delta", text: event.delta })
                }

                if (event.type === "done") {
                  send({
                    type: "done",
                    message: toChatMessage(assistantId, event.message),
                  })
                }

                if (event.type === "error") {
                  send({
                    type: "error",
                    message:
                      event.error.errorMessage ??
                      `Model stopped with ${event.reason}`,
                  })
                }
              }
            } catch (error) {
              if (!request.signal.aborted) {
                send({ type: "error", message: getErrorMessage(error) })
              }
            } finally {
              controller.close()
            }
          },
        })

        return new Response(readable, {
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
          },
        })
      },
    },
  },
})
