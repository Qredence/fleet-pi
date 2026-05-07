import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage, loadChatResources } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/resources")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(
            await loadChatResources(resolveAppRuntimeContext())
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
