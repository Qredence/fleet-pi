import { createFileRoute } from "@tanstack/react-router"
import { ChatSessionMetadataSchema } from "@workspace/hax-design/lib/pi/chat-protocol.zod"
import { createRequestLogger } from "@/lib/logger"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { abortActiveSession } from "@/lib/pi/server"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/abort")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId =
          request.headers.get("x-request-id") ?? crypto.randomUUID()
        const log = createRequestLogger(requestId)

        return wrapApiHandler(
          async () =>
            withAuthenticatedChatRequest(request, async ({ userId }) => {
              const metadata = ChatSessionMetadataSchema.parse(
                await request.json()
              )
              const runtimeMetadata = { ...metadata, userId }

              const ownership = await enforceChatSessionOwnership({
                sessionId: metadata.sessionId,
                sessionFile: metadata.sessionFile,
                userId,
              })
              if (!ownership.ok) {
                return ownership.response
              }

              log.info(
                { sessionId: metadata.sessionId },
                "abort request received"
              )
              const aborted = await abortActiveSession(runtimeMetadata)
              log.info({ aborted }, "abort request completed")
              return Response.json({ aborted })
            }),
          { log }
        )
      },
    },
  },
})
