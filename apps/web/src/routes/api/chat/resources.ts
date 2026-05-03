import { createFileRoute } from "@tanstack/react-router"
import {
  getResponseStatus,
  resolveAppRuntimeContext,
} from "@/lib/desktop/server"
import { getErrorMessage, loadChatResources } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/resources")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return Response.json(
            await loadChatResources(resolveAppRuntimeContext(request))
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
