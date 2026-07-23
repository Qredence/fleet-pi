import { createFileRoute } from "@tanstack/react-router"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import {
  WorkspaceQueryApiError,
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceItemDetailResponse,
} from "@/lib/workspace/workspace-query"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export async function workspaceItemHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async () => {
    const context = await resolveWorkspaceContext(request)
    const url = new URL(request.url)

    try {
      return Response.json(
        await createWorkspaceItemDetailResponse(
          context,
          url.searchParams.get("id")
        )
      )
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

export const Route = createFileRoute("/api/workspace/item")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceItemHandler(request),
    },
  },
})
