import { createFileRoute } from "@tanstack/react-router"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import {
  WorkspaceQueryApiError,
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceItemsResponse,
} from "@/lib/workspace/workspace-query"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export async function workspaceItemsHandler(
  request = new Request("http://localhost/api/workspace/items")
) {
  return withAuthenticatedChatRequest(request, async ({ authSession }) => {
    const context = await resolveWorkspaceContext(request, authSession?.user)

    try {
      return Response.json(await createWorkspaceItemsResponse(context))
    } catch (error) {
      if (error instanceof WorkspaceQueryApiError) {
        return Response.json(error.body, { status: error.status })
      }

      return Response.json(
        createUnexpectedWorkspaceQueryErrorResponse(context, error),
        { status: 500 }
      )
    }
  })
}

export const Route = createFileRoute("/api/workspace/items")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceItemsHandler(request),
    },
  },
})
