import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { AgentChat } from "@workspace/ui/components/agent-elements/agent-chat"
import { InputBar } from "@workspace/ui/components/agent-elements/input-bar"
import { ModelPicker } from "@workspace/ui/components/agent-elements/input/model-picker"
import { SpiralLoader } from "@workspace/ui/components/agent-elements/spiral-loader"
import type {
  ChatMessage,
  ChatStatus,
} from "@workspace/ui/components/agent-elements/chat-types"
import type { ModelOption } from "@workspace/ui/components/agent-elements/types"

export const Route = createFileRoute("/")({ component: Chat })

const MODELS: Array<ModelOption> = [
  {
    id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    name: "Claude Haiku",
    version: "4.5",
  },
  {
    id: "us.anthropic.claude-sonnet-4-6",
    name: "Claude Sonnet",
    version: "4.6",
  },
  {
    id: "us.anthropic.claude-opus-4-6-v1[1m]",
    name: "Claude Opus",
    version: "4.6",
  },
]

type ChatStreamEvent =
  | { type: "start"; id: string }
  | { type: "delta"; text: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; message: string }

function createTextMessage(
  role: ChatMessage["role"],
  text: string,
  id: string = crypto.randomUUID(),
): ChatMessage {
  return {
    id,
    role,
    createdAt: Date.now(),
    parts: [{ type: "text", text }],
  }
}

function appendAssistantDelta(
  messages: Array<ChatMessage>,
  assistantId: string,
  delta: string,
) {
  return messages.map((message) => {
    if (message.id !== assistantId) return message
    const text = message.parts
      .filter((part): part is { type: "text"; text: string } => {
        return part.type === "text" && typeof part.text === "string"
      })
      .map((part) => part.text)
      .join("")

    return {
      ...message,
      parts: [{ type: "text", text: `${text}${delta}` }],
    }
  })
}

async function readChatStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
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

function usePiChat(modelId: string) {
  const [messages, setMessages] = useState<Array<ChatMessage>>([])
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [error, setError] = useState<Error | null>(null)
  const messagesRef = useRef(messages)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("ready")
  }, [])

  const sendMessage = useCallback(
    async ({ text }: { text: string }) => {
      const trimmed = text.trim()
      if (!trimmed || status === "streaming" || status === "submitted") return

      const controller = new AbortController()
      abortRef.current?.abort()
      abortRef.current = controller
      setError(null)
      setStatus("submitted")

      const userMessage = createTextMessage("user", trimmed)
      const requestMessages = [...messagesRef.current, userMessage]
      messagesRef.current = requestMessages
      setMessages(requestMessages)

      let assistantId: string | null = null

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: requestMessages,
            model: modelId,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.text()
          throw new Error(body || `Chat request failed (${response.status})`)
        }

        await readChatStream(response, (event) => {
          if (event.type === "start") {
            assistantId = event.id
            const assistantMessage = createTextMessage("assistant", "", event.id)
            setMessages((current) => [...current, assistantMessage])
            setStatus("streaming")
            return
          }

          if (event.type === "delta" && assistantId) {
            const activeAssistantId = assistantId
            setMessages((current) =>
              appendAssistantDelta(current, activeAssistantId, event.text),
            )
            return
          }

          if (event.type === "done") {
            setMessages((current) =>
              current.map((message) =>
                message.id === event.message.id ? event.message : message,
              ),
            )
            return
          }

          if (event.type === "error") {
            throw new Error(event.message)
          }
        })

        setStatus("ready")
      } catch (err) {
        if (controller.signal.aborted) return
        const nextError = err instanceof Error ? err : new Error(String(err))
        setError(nextError)
        setStatus("error")
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [modelId, status],
  )

  return { messages, sendMessage, status, stop, error }
}

function Chat() {
  const [modelId, setModelId] = useState(MODELS[1].id)
  const { messages, sendMessage, status, stop, error } = usePiChat(modelId)

  return (
    <div className="h-svh">
      <AgentChat
        messages={messages}
        status={status}
        onSend={(msg) => sendMessage({ text: msg.content })}
        onStop={stop}
        error={error ?? undefined}
        emptyStatePosition="center"
        suggestions={[
          { id: "1", label: "What can you do?" },
          { id: "2", label: "Tell me about this project" },
        ]}
        slots={{
          InputBar: (props) => (
            <InputBar
              {...props}
              leftActions={
                <ModelPicker
                  models={MODELS}
                  value={modelId}
                  onChange={setModelId}
                />
              }
              rightActions={
                <div className="flex items-center gap-1">
                  {(status === "streaming" || status === "submitted") && (
                    <SpiralLoader size={16} />
                  )}
                </div>
              }
            />
          ),
        }}
      />
    </div>
  )
}
