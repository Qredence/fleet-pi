import { createFileRoute } from "@tanstack/react-router"
import type { ChatSessionMetadata } from "@/lib/pi/chat-protocol"
import { resolveAppRuntimeContext } from "@/lib/desktop/server"
import { hydrateChatSession } from "@/lib/pi/server"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/session")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        wrapApiHandler(async () => {
          const url = new URL(request.url)
          const metadata: ChatSessionMetadata = {
            sessionFile: url.searchParams.get("sessionFile") ?? undefined,
            sessionId: url.searchParams.get("sessionId") ?? undefined,
          }
          return Response.json(
            await hydrateChatSession(
              resolveAppRuntimeContext(request),
              metadata
            )
          )
        }),
    },
  },
})
