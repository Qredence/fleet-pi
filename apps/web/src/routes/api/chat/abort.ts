import { createFileRoute } from "@tanstack/react-router"
import type { ChatSessionMetadata } from "@/lib/pi/chat-protocol"
import { createRequestLogger } from "@/lib/logger"
import { abortActiveSession, getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/abort")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId =
          request.headers.get("x-request-id") ?? crypto.randomUUID()
        const log = createRequestLogger(requestId)

        try {
          const metadata = (await request.json()) as ChatSessionMetadata
          log.info({ sessionId: metadata.sessionId }, "abort request received")
          const aborted = await abortActiveSession(metadata)
          log.info({ aborted }, "abort request completed")
          return Response.json({ aborted })
        } catch (error) {
          log.error({ error: getErrorMessage(error) }, "abort request failed")
          return Response.json(
            { message: getErrorMessage(error) },
            { status: 500 }
          )
        }
      },
    },
  },
})
