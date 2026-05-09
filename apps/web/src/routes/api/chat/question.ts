import { createFileRoute } from "@tanstack/react-router"
import type { ChatQuestionAnswerResponse } from "@/lib/pi/chat-protocol"
import { createRequestLogger } from "@/lib/logger"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { answerChatQuestion } from "@/lib/pi/server"
import { ChatQuestionAnswerRequestSchema } from "@/lib/pi/chat-protocol.zod"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/question")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId =
          request.headers.get("x-request-id") ?? crypto.randomUUID()
        const log = createRequestLogger(requestId)

        return wrapApiHandler(
          async () => {
            resolveAppRuntimeContext()
            const body = ChatQuestionAnswerRequestSchema.parse(
              await request.json()
            )

            log.info(
              { toolCallId: body.toolCallId },
              "question answer received"
            )
            const result: ChatQuestionAnswerResponse = answerChatQuestion(body)
            log.info({ ok: result.ok }, "question answer processed")
            return Response.json(result, { status: result.ok ? 200 : 404 })
          },
          { log }
        )
      },
    },
  },
})
