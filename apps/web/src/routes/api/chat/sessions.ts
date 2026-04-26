import { createFileRoute } from "@tanstack/react-router"
import { getErrorMessage, listChatSessions } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/sessions")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json({ sessions: await listChatSessions() })
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
