import { ChatQuestionAnswerRequestSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import type { ChatQuestionAnswerResponse } from "@workspace/pi-protocol/chat-protocol"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { wrapApiHandler } from "@/lib/api-utils"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { createRequestLogger } from "@/lib/logger"
import { answerChatQuestion } from "@/lib/pi/server"

export async function questionChatHandler(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  const log = createRequestLogger(requestId)

  return wrapApiHandler(
    async () =>
      withAuthenticatedChatRequest(request, async ({ userId }) => {
        resolveAppRuntimeContext()
        const body = ChatQuestionAnswerRequestSchema.parse(await request.json())
        const ownership = await enforceChatSessionOwnership({
          sessionId: body.sessionId,
          sessionFile: body.sessionFile,
          userId,
        })
        if (!ownership.ok) {
          return ownership.response
        }

        log.info({ toolCallId: body.toolCallId }, "question answer received")
        const result: ChatQuestionAnswerResponse = answerChatQuestion(body)
        log.info({ ok: result.ok }, "question answer processed")
        return Response.json(result, { status: result.ok ? 200 : 404 })
      }),
    { log }
  )
}
