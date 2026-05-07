import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage, listChatSessions } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/sessions")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json({
            sessions: await listChatSessions(resolveAppRuntimeContext()),
          })
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
