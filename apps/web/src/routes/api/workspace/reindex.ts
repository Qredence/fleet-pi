import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "../../../lib/app-runtime"
import {
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceReindexResponse,
} from "../../../lib/workspace/workspace-query"

export async function workspaceReindexHandler() {
  const context = resolveAppRuntimeContext()

  try {
    const response = await createWorkspaceReindexResponse(context)
    return Response.json(response.body, { status: response.status })
  } catch (error) {
    return Response.json(
      createUnexpectedWorkspaceQueryErrorResponse(context, error),
      { status: 500 }
    )
  }
}

export const Route = createFileRoute("/api/workspace/reindex")({
  server: {
    handlers: {
      POST: workspaceReindexHandler,
    },
  },
})
