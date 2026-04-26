import { createFileRoute } from "@tanstack/react-router"
import type { ChatSessionMetadata } from "@/lib/pi/chat-protocol"
import { getErrorMessage, hydrateChatSession } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/resume")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const metadata = (await request.json()) as ChatSessionMetadata
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
