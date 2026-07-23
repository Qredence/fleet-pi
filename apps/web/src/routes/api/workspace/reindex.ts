import { createFileRoute } from "@tanstack/react-router"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import {
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceReindexResponse,
} from "@/lib/workspace/workspace-query"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export async function workspaceReindexHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async () => {
    const context = await resolveWorkspaceContext(request)

    try {
      const response = await createWorkspaceReindexResponse(context)
      return Response.json(response.body, { status: response.status })
    } catch (error) {
      return Response.json(
        createUnexpectedWorkspaceQueryErrorResponse(context, error),
        { status: 500 }
      )
    }
  })
}

export const Route = createFileRoute("/api/workspace/reindex")({
  server: {
    handlers: {
      POST: ({ request }) => workspaceReindexHandler(request),
    },
  },
})
