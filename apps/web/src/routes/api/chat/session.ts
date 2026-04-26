import { createFileRoute } from "@tanstack/react-router"
import type { ChatSessionMetadata } from "@/lib/pi/chat-protocol"
import { getErrorMessage, hydrateChatSession } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const metadata: ChatSessionMetadata = {
            sessionFile: url.searchParams.get("sessionFile") ?? undefined,
            sessionId: url.searchParams.get("sessionId") ?? undefined,
          }
          return Response.json(await hydrateChatSession(metadata))
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: 500 },
          )
        }
      },
    },
  },
})
