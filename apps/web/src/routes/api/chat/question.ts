import { createFileRoute } from "@tanstack/react-router"
import type {
  ChatQuestionAnswerRequest,
  ChatQuestionAnswerResponse,
} from "@/lib/pi/chat-protocol"
import { createRequestLogger } from "@/lib/logger"
import { answerChatQuestion } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/question")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId =
          request.headers.get("x-request-id") ?? crypto.randomUUID()
        const log = createRequestLogger(requestId)

        const body =
          (await request.json()) as Partial<ChatQuestionAnswerRequest>
        if (!body.answer) {
          log.warn("missing answer in question request")
          return new Response("Missing answer", { status: 400 })
        }

        log.info({ toolCallId: body.toolCallId }, "question answer received")
        const result: ChatQuestionAnswerResponse = answerChatQuestion(
          body as ChatQuestionAnswerRequest
        )
        log.info({ ok: result.ok }, "question answer processed")
        return Response.json(result, { status: result.ok ? 200 : 404 })
      },
    },
  },
})
