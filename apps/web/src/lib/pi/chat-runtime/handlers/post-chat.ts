import { ChatRequestSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import type {
  ChatRequest,
  ChatStreamEvent,
} from "@workspace/pi-protocol/chat-protocol"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { createRequestLogger } from "@/lib/logger"
import { handleChatTurn } from "@/lib/pi/handle-chat-turn"
import {
  encodeEvent,
  getErrorMessage,
  queuePromptOnActiveSession,
} from "@/lib/pi/server"
import { createRunProvenanceRecorder } from "@/lib/pi/run-provenance"
import { sanitizePii } from "@/lib/pii/sanitizer"

export async function postChatHandler(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  const log = createRequestLogger(requestId)

  return withAuthenticatedChatRequest(request, async ({ authSession }) => {
    try {
      const runtimeContext = resolveAppRuntimeContext()
      const body = ChatRequestSchema.parse(await request.json()) as ChatRequest
      if (authSession?.user) {
        body.userId = authSession.user.id
        body.userEmail = authSession.user.email ?? undefined
      }
      const rawPrompt =
        typeof body.message === "string" ? body.message.trim() : ""
      const prompt = sanitizePii(rawPrompt)

      const ownership = await enforceChatSessionOwnership({
        sessionId: body.sessionId,
        sessionFile: body.sessionFile,
        userId: authSession?.user.id,
      })
      if (!ownership.ok) {
        return ownership.response
      }

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

      const recorder = createRunProvenanceRecorder(runtimeContext, {
        mode: body.mode,
        planAction: body.planAction,
        userId: body.userId,
      })

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            log.info("starting chat turn")
            for await (const event of handleChatTurn({
              body,
              signal: request.signal,
              recorder,
              runtimeContext,
              prompt,
            })) {
              controller.enqueue(encodeEvent(event))
            }
            log.info("chat stream completed")
          } catch (error) {
            log.error({ error: getErrorMessage(error) }, "chat stream error")
          } finally {
            void recorder.close()
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
  })
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
