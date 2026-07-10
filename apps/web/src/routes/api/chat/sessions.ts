import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage, listChatSessions } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/sessions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await withAuthenticatedChatRequest(
            request,
            async ({ userId }) =>
              Response.json({
                sessions: await listChatSessions(resolveAppRuntimeContext(), {
                  userId,
                }),
              })
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
