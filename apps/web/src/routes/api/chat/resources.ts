import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage, loadChatResources } from "@/lib/pi/server"

export async function chatResourcesHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ userId }) => {
    try {
      return Response.json(
        await loadChatResources(resolveAppRuntimeContext(), {
          userId,
        })
      )
    } catch (error) {
      return Response.json(
        { message: getErrorMessage(error) },
        { status: getResponseStatus(error) }
      )
    }
  })
}

export const Route = createFileRoute("/api/chat/resources")({
  server: {
    handlers: {
      GET: ({ request }) => chatResourcesHandler(request),
    },
  },
})
