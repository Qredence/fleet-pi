import { createFileRoute } from "@tanstack/react-router"
import { getErrorMessage, loadChatResources } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/resources")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await loadChatResources())
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
