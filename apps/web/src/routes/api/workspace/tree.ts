import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage } from "@/lib/pi/server"
import { loadAgentWorkspaceTree } from "@/lib/workspace/server"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export async function workspaceTreeHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async () => {
    try {
      const context = await resolveWorkspaceContext(request)
      return Response.json(await loadAgentWorkspaceTree(context))
    } catch (error) {
      return Response.json(
        { message: getErrorMessage(error) },
        {
          status: getErrorMessage(error).includes("daytona_credential_required")
            ? 403
            : getResponseStatus(error),
        }
      )
    }
  })
}

export const Route = createFileRoute("/api/workspace/tree")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceTreeHandler(request),
    },
  },
})
