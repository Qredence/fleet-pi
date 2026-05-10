import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "../../../lib/app-runtime"
import {
  WorkspaceQueryApiError,
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceSearchResponse,
} from "../../../lib/workspace/workspace-query"

export async function workspaceSearchHandler(request: Request) {
  const context = resolveAppRuntimeContext()
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
}

export const Route = createFileRoute("/api/workspace/search")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceSearchHandler(request),
    },
  },
})
