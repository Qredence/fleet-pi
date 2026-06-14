import { createFileRoute } from "@tanstack/react-router"
import { ChatRequestSchema } from "@workspace/hax-design/lib/pi/chat-protocol.zod"
import type {
  ChatRequest,
  ChatStreamEvent,
} from "@workspace/hax-design/lib/pi/chat-protocol"
import type {
  AssistantTurnState,
  TurnStartContext,
} from "@/lib/pi/server-chat-stream"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { auth } from "@/lib/auth/server"
import { syncPiSessionMirrorSafely } from "@/lib/db/pi-session-mirror"
import { createRequestLogger } from "@/lib/logger"
import { createPlanEvent, getPlanState } from "@/lib/pi/plan-mode"
import {
  createPiRuntime,
  encodeEvent,
  getErrorMessage,
  queuePromptOnActiveSession,
  retainPiRuntime,
} from "@/lib/pi/server"
import {
  beginAssistantTurn,
  completeAssistantTurn,
  createTurnStartContext,
  finalizeAssistantTurn,
  handleSessionEvent,
  shouldEmitInitialPlanEvent,
} from "@/lib/pi/server-chat-stream"
import { createRunProvenanceRecorder } from "@/lib/pi/run-provenance"
import { sanitizePii } from "@/lib/pii/sanitizer"

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId =
          request.headers.get("x-request-id") ?? crypto.randomUUID()
        const log = createRequestLogger(requestId)

        try {
          const runtimeContext = resolveAppRuntimeContext()
          const authSession = await auth.api
            .getSession({ headers: request.headers })
            .catch(() => null)
          const body = ChatRequestSchema.parse(
            await request.json()
          ) as ChatRequest
          if (authSession?.user) {
            body.userId = authSession.user.id
            body.userEmail = authSession.user.email
          }
          const rawPrompt =
            typeof body.message === "string" ? body.message.trim() : ""
          const prompt = sanitizePii(rawPrompt)

          if (authSession?.user && body.sessionId) {
            const { verifySessionOwnership } =
              await import("@/lib/db/pi-session-mirror")
            const isOwner = await verifySessionOwnership(
              body.sessionId,
              authSession.user.id
            )
            if (!isOwner) {
              return new Response(
                JSON.stringify({
                  message: "Forbidden: Session belongs to another user",
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" },
                }
              )
            }
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

          const readable = new ReadableStream<Uint8Array>({
            async start(controller) {
              let unsubscribe: (() => void) | undefined
              let releaseRuntime: (() => void) | undefined
              let activeTurn: AssistantTurnState | undefined
              let turnStartContext: TurnStartContext | undefined
              let queuedPromptCount = 0
              const recorder = createRunProvenanceRecorder(runtimeContext, {
                mode: body.mode,
                planAction: body.planAction,
                userId: body.userId,
              })
              const send = (event: ChatStreamEvent) => {
                recorder.record(event)
                controller.enqueue(encodeEvent(event))
              }

              try {
                log.info("creating pi runtime")
                const result = await createPiRuntime(
                  runtimeContext,
                  body,
                  body.model
                )
                const currentSession = result.runtime.session
                releaseRuntime = retainPiRuntime(result.runtime, body.userId)
                log.info(
                  {
                    sessionId: currentSession.sessionId,
                    sessionReset: result.sessionReset,
                  },
                  "pi runtime created"
                )
                const abort = () => void currentSession.abort()

                request.signal.addEventListener("abort", abort, { once: true })
                const initialPlanState = getPlanState(result.runtime)
                if (shouldEmitInitialPlanEvent(initialPlanState)) {
                  send(createPlanEvent(initialPlanState))
                }
                turnStartContext = createTurnStartContext({
                  diagnostics: result.diagnostics,
                  send,
                  session: currentSession,
                  sessionReset: result.sessionReset,
                })

                unsubscribe = currentSession.subscribe((event) => {
                  const nextTurn = handleSessionEvent(
                    event,
                    activeTurn,
                    turnStartContext!
                  )
                  activeTurn = nextTurn

                  if (event.type === "queue_update") {
                    const nextQueuedPromptCount =
                      event.steering.length + event.followUp.length

                    if (
                      nextQueuedPromptCount < queuedPromptCount &&
                      activeTurn &&
                      !activeTurn.hadError
                    ) {
                      activeTurn = finalizeAssistantTurn({
                        activeTurn,
                        body,
                        runtime: result.runtime,
                        send,
                        session: currentSession,
                        sessionReset: result.sessionReset,
                      })
                    }

                    queuedPromptCount = nextQueuedPromptCount
                  }
                })

                await currentSession.prompt(prompt, {
                  expandPromptTemplates: true,
                })
                request.signal.removeEventListener("abort", abort)

                activeTurn = completeAssistantTurn({
                  activeTurn,
                  body,
                  runtime: result.runtime,
                  send,
                  session: currentSession,
                  sessionReset: result.sessionReset,
                })
                // Fire-and-forget: mirror sync must not delay stream close.
                void syncPiSessionMirrorSafely(
                  result.runtime.session.sessionManager,
                  { userId: body.userId }
                )

                log.info(
                  { sessionId: currentSession.sessionId },
                  "chat stream completed"
                )
              } catch (error) {
                log.error(
                  { error: getErrorMessage(error) },
                  "chat stream error"
                )
                if (!request.signal.aborted) {
                  if (turnStartContext?.firstStartPending) {
                    const errorTurn = beginAssistantTurn(turnStartContext)
                    send({
                      type: "error",
                      message: getErrorMessage(error),
                      runId: errorTurn.runId,
                    })
                  } else {
                    send({ type: "error", message: getErrorMessage(error) })
                  }
                }
              } finally {
                unsubscribe?.()
                releaseRuntime?.()
                // Fire-and-forget: mirror queue flush must not delay stream close.
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
      },
    },
  },
})

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
