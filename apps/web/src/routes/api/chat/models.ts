import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage, loadChatModels } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/models")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await loadChatModels(resolveAppRuntimeContext()))
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
