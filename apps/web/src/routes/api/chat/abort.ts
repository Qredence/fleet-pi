import { createFileRoute } from "@tanstack/react-router"
import type { ChatSessionMetadata } from "@/lib/pi/chat-protocol"
import { createRequestLogger } from "@/lib/logger"
import { resolveAppRuntimeContext } from "@/lib/desktop/server"
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
          async () => {
            resolveAppRuntimeContext(request, { requireProject: false })
            const metadata = (await request.json()) as ChatSessionMetadata
            log.info(
              { sessionId: metadata.sessionId },
              "abort request received"
            )
            const aborted = await abortActiveSession(metadata)
            log.info({ aborted }, "abort request completed")
            return Response.json({ aborted })
          },
          { log }
        )
      },
    },
  },
})
