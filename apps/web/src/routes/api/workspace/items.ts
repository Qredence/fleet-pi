import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  WorkspaceQueryApiError,
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceItemsResponse,
} from "@/lib/workspace/workspace-query"

export async function workspaceItemsHandler() {
  const context = resolveAppRuntimeContext()

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
}

export const Route = createFileRoute("/api/workspace/items")({
  server: {
    handlers: {
      GET: workspaceItemsHandler,
    },
  },
})
