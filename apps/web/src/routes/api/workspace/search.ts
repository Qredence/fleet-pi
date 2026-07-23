import { createFileRoute } from "@tanstack/react-router"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import {
  WorkspaceQueryApiError,
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceSearchResponse,
} from "@/lib/workspace/workspace-query"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export async function workspaceSearchHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ authSession }) => {
    const context = await resolveWorkspaceContext(request, authSession?.user)
    const url = new URL(request.url)

    try {
      return Response.json(
        await createWorkspaceSearchResponse(context, url.searchParams.get("q"))
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

export const Route = createFileRoute("/api/workspace/search")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceSearchHandler(request),
    },
  },
})
