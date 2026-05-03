import { createFileRoute } from "@tanstack/react-router"
import {
  getResponseStatus,
  resolveAppRuntimeContext,
} from "@/lib/desktop/server"
import { createNewChatSession, getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/new")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return Response.json(
            await createNewChatSession(resolveAppRuntimeContext(request))
          )
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
    },
  },
})
