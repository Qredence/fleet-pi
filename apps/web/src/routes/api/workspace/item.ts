import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  WorkspaceQueryApiError,
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceItemDetailResponse,
} from "@/lib/workspace/workspace-query"

export async function workspaceItemHandler(request: Request) {
  const context = resolveAppRuntimeContext()
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
}

export const Route = createFileRoute("/api/workspace/item")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceItemHandler(request),
    },
  },
})
