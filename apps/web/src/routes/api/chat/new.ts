import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { createNewChatSession, getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/new")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return Response.json(
            await createNewChatSession(resolveAppRuntimeContext())
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
