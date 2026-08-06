import { createFileRoute } from "@tanstack/react-router"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import {
  RequestContextError,
  getResponseStatus,
  resolveAppRuntimeContext,
} from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import {
  WorkspaceQueryApiError,
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceSearchResponse,
} from "@/lib/workspace/workspace-query"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"
import { getErrorMessage } from "@/lib/pi/server"

export async function workspaceSearchHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ authSession }) => {
    const url = new URL(request.url)
    let context: AppRuntimeContext | undefined

    try {
      context = await resolveWorkspaceContext(request, authSession?.user)
      return Response.json(
        await createWorkspaceSearchResponse(context, url.searchParams.get("q"))
      )
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

export const Route = createFileRoute("/api/workspace/search")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceSearchHandler(request),
    },
  },
})
