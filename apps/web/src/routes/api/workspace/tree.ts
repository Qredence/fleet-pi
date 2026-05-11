import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage } from "@/lib/pi/server"
import { loadAgentWorkspaceTree } from "@/lib/workspace/server"

export async function workspaceTreeHandler() {
  try {
    return Response.json(
      await loadAgentWorkspaceTree(resolveAppRuntimeContext())
    )
  } catch (error) {
    return Response.json(
      { message: getErrorMessage(error) },
      { status: getResponseStatus(error) }
    )
  }
}

export const Route = createFileRoute("/api/workspace/tree")({
  server: {
    handlers: {
      GET: workspaceTreeHandler,
    },
  },
})
