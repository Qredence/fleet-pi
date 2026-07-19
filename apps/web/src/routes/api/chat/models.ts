import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getChatAuthSession } from "@/lib/auth/chat-api-auth"
import { getErrorMessage, loadChatModels } from "@/lib/pi/server"

function parseModelsScope(url: string): "enabled" | "all" {
  const scope = new URL(url).searchParams.get("scope")
  return scope === "all" ? "all" : "enabled"
}

export const Route = createFileRoute("/api/chat/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authSession = await getChatAuthSession(request)
          return Response.json(
            await loadChatModels(resolveAppRuntimeContext(), {
              scope: parseModelsScope(request.url),
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
