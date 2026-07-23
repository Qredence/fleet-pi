import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { loadChatCommands } from "@/lib/pi/runtime/command-catalog"
import { getErrorMessage } from "@/lib/pi/server"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export async function chatCommandsHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ userId }) => {
    try {
      const context = await resolveWorkspaceContext(request)
      return Response.json(
        await loadChatCommands(context, {
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

export const Route = createFileRoute("/api/chat/commands")({
  server: {
    handlers: {
      GET: ({ request }) => chatCommandsHandler(request),
    },
  },
})
