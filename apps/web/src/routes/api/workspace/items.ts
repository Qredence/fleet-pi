import { createFileRoute } from "@tanstack/react-router"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import {
  RequestContextError,
  getResponseStatus,
  resolveAppRuntimeContext,
} from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage } from "@/lib/pi/server"
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
    let context: AppRuntimeContext | undefined
    try {
      context = await resolveWorkspaceContext(request, authSession?.user)
      return Response.json(await createWorkspaceItemsResponse(context))
    } catch (error) {
      if (error instanceof WorkspaceQueryApiError) {
        return Response.json(error.body, { status: error.status })
      }

      if (error instanceof RequestContextError) {
        return Response.json(
          { message: getErrorMessage(error) },
          { status: getResponseStatus(error) }
        )
      }

      return Response.json(
        createUnexpectedWorkspaceQueryErrorResponse(
          context ?? resolveAppRuntimeContext(),
          error
        ),
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
