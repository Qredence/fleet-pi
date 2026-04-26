import { createFileRoute } from "@tanstack/react-router"
import { createNewChatSession, getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/new")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return Response.json(await createNewChatSession())
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
