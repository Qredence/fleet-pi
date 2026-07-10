import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { createNewChatSession, getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/new")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await withAuthenticatedChatRequest(
            request,
            async ({ userId }) =>
              Response.json(
                await createNewChatSession(resolveAppRuntimeContext(), {
                  userId,
                })
              )
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
