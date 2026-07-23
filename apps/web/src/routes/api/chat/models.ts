import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage, loadChatModels } from "@/lib/pi/server"

function parseModelsScope(url: string): "enabled" | "all" {
  const scope = new URL(url).searchParams.get("scope")
  return scope === "all" ? "all" : "enabled"
}

export async function chatModelsHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ userId }) => {
    try {
      return Response.json(
        await loadChatModels(resolveAppRuntimeContext(), {
          scope: parseModelsScope(request.url),
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

export const Route = createFileRoute("/api/chat/models")({
  server: {
    handlers: {
      GET: ({ request }) => chatModelsHandler(request),
    },
  },
})
