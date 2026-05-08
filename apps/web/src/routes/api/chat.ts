import { createFileRoute } from "@tanstack/react-router"
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent"
import type { ChatMessagePart } from "@workspace/ui/components/agent-elements/chat-types"
import type { ChatRequest, ChatStreamEvent } from "@/lib/pi/chat-protocol"
import { createRequestLogger } from "@/lib/logger"
import { sanitizePii } from "@/lib/pii/sanitizer"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  createPiRuntime,
  encodeEvent,
  getErrorMessage,
  queuePromptOnActiveSession,
  retainPiRuntime,
} from "@/lib/pi/server"
import {
  appendTextPart,
  toChatMessage,
  toToolPart,
  upsertThinkingPart,
  upsertToolPart,
} from "@/lib/pi/server-utils"
import {
  createPlanEvent,
  finalizePlanTurn,
  getPlanState,
} from "@/lib/pi/plan-mode"

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId =
          request.headers.get("x-request-id") ?? crypto.randomUUID()
        const log = createRequestLogger(requestId)

        try {
          const runtimeContext = resolveAppRuntimeContext()
          const body = (await request.json()) as ChatRequest
          const rawPrompt =
            typeof body.message === "string" ? body.message.trim() : ""
          const prompt = sanitizePii(rawPrompt)

          log.info(
            { mode: body.mode, hasMessage: Boolean(prompt) },
            "chat request received"
          )

          if (!prompt) {
            log.warn("missing message in chat request")
            return new Response("Missing message", { status: 400 })
          }

          if (body.streamingBehavior) {
            const queued = await queuePromptOnActiveSession(
              body,
              prompt,
              body.streamingBehavior
            )
            if (queued) {
              log.info(
                { streamingBehavior: body.streamingBehavior },
                "prompt queued on active session"
              )
              return streamEvents([
                {
                  type: "queue",
                  steering: queued.steering,
                  followUp: queued.followUp,
                },
              ])
            }
          }

          const assistantId = crypto.randomUUID()

          const readable = new ReadableStream<Uint8Array>({
            async start(controller) {
              const send = (event: ChatStreamEvent) => {
                controller.enqueue(encodeEvent(event))
              }

              let unsubscribe: (() => void) | undefined
              let releaseRuntime: (() => void) | undefined
              let session:
                | Awaited<
                    ReturnType<typeof createPiRuntime>
                  >["runtime"]["session"]
                | undefined
              let parts: Array<ChatMessagePart> = []
              let thinkingText = ""
              const toolInputs = new Map<string, Record<string, unknown>>()

              try {
                log.info("creating pi runtime")
                const result = await createPiRuntime(
                  runtimeContext,
                  body,
                  body.model
                )
                session = result.runtime.session
                releaseRuntime = retainPiRuntime(result.runtime)
                log.info(
                  {
                    sessionId: session.sessionId,
                    sessionReset: result.sessionReset,
                  },
                  "pi runtime created"
                )
                send(createPlanEvent(getPlanState(result.runtime)))
                const abort = () => void session?.abort()

                request.signal.addEventListener("abort", abort, { once: true })
                send({
                  type: "start",
                  id: assistantId,
                  sessionFile: session.sessionFile,
                  sessionId: session.sessionId,
                  sessionReset: result.sessionReset,
                  diagnostics: result.diagnostics,
                })

                unsubscribe = session.subscribe((event) => {
                  const nextParts = handleSessionEvent(
                    event,
                    parts,
                    thinkingText,
                    toolInputs,
                    send
                  )
                  parts = nextParts.parts
                  thinkingText = nextParts.thinkingText
                })

                await session.prompt(prompt, { expandPromptTemplates: true })
                request.signal.removeEventListener("abort", abort)

                const assistantText = textFromParts(parts)
                const planTurn = finalizePlanTurn({
                  runtime: result.runtime,
                  assistantId,
                  assistantText,
                  mode: body.mode,
                  planAction: body.planAction,
                })
                if (planTurn) {
                  if (planTurn.decisionPart) {
                    parts = upsertToolPart(parts, planTurn.decisionPart)
                    send({ type: "tool", part: planTurn.decisionPart })
                  }
                  send(createPlanEvent(planTurn.state))
                }

                log.info(
                  { assistantId, partCount: parts.length },
                  "chat stream completed"
                )
                send({
                  type: "done",
                  message: toChatMessage(assistantId, "assistant", parts),
                  sessionFile: session.sessionFile,
                  sessionId: session.sessionId,
                  sessionReset: result.sessionReset,
                })
              } catch (error) {
                log.error(
                  { error: getErrorMessage(error) },
                  "chat stream error"
                )
                if (!request.signal.aborted) {
                  send({ type: "error", message: getErrorMessage(error) })
                }
              } finally {
                unsubscribe?.()
                releaseRuntime?.()
                controller.close()
              }
            },
          })

          return createNdjsonResponse(readable)
        } catch (error) {
          log.error({ error: getErrorMessage(error) }, "chat request failed")
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
    },
  },
})

function handleSessionEvent(
  event: AgentSessionEvent,
  parts: Array<ChatMessagePart>,
  thinkingText: string,
  toolInputs: Map<string, Record<string, unknown>>,
  send: (event: ChatStreamEvent) => void
) {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    const nextParts = appendTextPart(parts, event.assistantMessageEvent.delta)
    send({ type: "delta", text: event.assistantMessageEvent.delta })
    return { parts: nextParts, thinkingText }
  }

  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "thinking_delta"
  ) {
    const nextThinkingText = `${thinkingText}${event.assistantMessageEvent.delta}`
    const nextParts = upsertThinkingPart(parts, nextThinkingText)
    send({ type: "thinking", text: nextThinkingText })
    return { parts: nextParts, thinkingText: nextThinkingText }
  }

  if (
    event.type === "tool_execution_start" ||
    event.type === "tool_execution_update" ||
    event.type === "tool_execution_end"
  ) {
    const part = toToolPart(event, toolInputs.get(event.toolCallId))
    if (event.type !== "tool_execution_end") {
      toolInputs.set(event.toolCallId, part.input as Record<string, unknown>)
    }
    const nextParts = upsertToolPart(parts, part)
    send({ type: "tool", part })
    return { parts: nextParts, thinkingText }
  }

  if (event.type === "queue_update") {
    send({
      type: "queue",
      steering: [...event.steering],
      followUp: [...event.followUp],
    })
    return { parts, thinkingText }
  }

  if (event.type === "compaction_start") {
    send({ type: "compaction", phase: "start", reason: event.reason })
    return { parts, thinkingText }
  }

  if (event.type === "compaction_end") {
    send({
      type: "compaction",
      phase: "end",
      reason: event.reason,
      aborted: event.aborted,
      willRetry: event.willRetry,
      errorMessage: event.errorMessage,
    })
    return { parts, thinkingText }
  }

  if (event.type === "auto_retry_start") {
    send({
      type: "retry",
      phase: "start",
      attempt: event.attempt,
      maxAttempts: event.maxAttempts,
      delayMs: event.delayMs,
      errorMessage: event.errorMessage,
    })
    return { parts, thinkingText }
  }

  if (event.type === "auto_retry_end") {
    send({
      type: "retry",
      phase: "end",
      success: event.success,
      attempt: event.attempt,
      finalError: event.finalError,
    })
    return { parts, thinkingText }
  }

  if (isStateEvent(event)) {
    send({ type: "state", state: { name: event.type } })
  }

  if (event.type === "message_end" && isAssistantErrorMessage(event.message)) {
    send({ type: "error", message: event.message.errorMessage })
  }

  return { parts, thinkingText }
}

function textFromParts(parts: Array<ChatMessagePart>) {
  return parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
}

function isAssistantErrorMessage(
  message: unknown
): message is { role: "assistant"; stopReason: "error"; errorMessage: string } {
  return (
    message !== null &&
    typeof message === "object" &&
    "role" in message &&
    message.role === "assistant" &&
    "stopReason" in message &&
    message.stopReason === "error" &&
    "errorMessage" in message &&
    typeof message.errorMessage === "string"
  )
}

function isStateEvent(event: AgentSessionEvent): event is Extract<
  AgentSessionEvent,
  {
    type:
      | "agent_start"
      | "agent_end"
      | "turn_start"
      | "turn_end"
      | "message_start"
      | "message_end"
  }
> {
  return (
    event.type === "agent_start" ||
    event.type === "agent_end" ||
    event.type === "turn_start" ||
    event.type === "turn_end" ||
    event.type === "message_start" ||
    event.type === "message_end"
  )
}

function streamEvents(events: Array<ChatStreamEvent>) {
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encodeEvent(event))
      }
      controller.close()
    },
  })

  return createNdjsonResponse(readable)
}

function createNdjsonResponse(readable: ReadableStream<Uint8Array>) {
  return new Response(readable, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
