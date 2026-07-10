import { createFileRoute } from "@tanstack/react-router"
import { ChatQuestionAnswerRequestSchema } from "@workspace/hax-design/lib/pi/chat-protocol.zod"
import type { ChatQuestionAnswerResponse } from "@workspace/hax-design/lib/pi/chat-protocol"
import { createRequestLogger } from "@/lib/logger"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { answerChatQuestion } from "@/lib/pi/server"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/question")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId =
          request.headers.get("x-request-id") ?? crypto.randomUUID()
        const log = createRequestLogger(requestId)

        return wrapApiHandler(
          async () =>
            withAuthenticatedChatRequest(request, async ({ userId }) => {
              resolveAppRuntimeContext()
              const body = ChatQuestionAnswerRequestSchema.parse(
                await request.json()
              )
              const runtimeRequest = { ...body, userId }

              log.info(
                { toolCallId: body.toolCallId },
                "question answer received"
              )
              const result: ChatQuestionAnswerResponse =
                answerChatQuestion(runtimeRequest)
              log.info({ ok: result.ok }, "question answer processed")
              return Response.json(result, { status: result.ok ? 200 : 404 })
            }),
          { log }
        )
      },
    },
  },
})
