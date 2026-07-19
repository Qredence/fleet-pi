import { ChatSessionMetadataSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import { wrapApiHandler } from "@/lib/api-utils"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { createRequestLogger } from "@/lib/logger"
import { abortActiveSession } from "@/lib/pi/server"

export async function abortChatHandler(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  const log = createRequestLogger(requestId)

  return wrapApiHandler(
    async () =>
      withAuthenticatedChatRequest(request, async ({ userId }) => {
        const metadata = ChatSessionMetadataSchema.parse(await request.json())
        const ownership = await enforceChatSessionOwnership({
          sessionId: metadata.sessionId,
          sessionFile: metadata.sessionFile,
          userId,
        })
        if (!ownership.ok) {
          return ownership.response
        }

        log.info({ sessionId: metadata.sessionId }, "abort request received")
        const aborted = await abortActiveSession({ ...metadata, userId })
        log.info({ aborted }, "abort request completed")
        return Response.json({ aborted })
      }),
    { log }
  )
}
