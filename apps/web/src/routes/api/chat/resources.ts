import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getChatAuthSession } from "@/lib/auth/chat-api-auth"
import { getErrorMessage, loadChatResources } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/resources")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authSession = await getChatAuthSession(request)
          return Response.json(
            await loadChatResources(resolveAppRuntimeContext(), {
              userId: authSession?.user.id,
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
