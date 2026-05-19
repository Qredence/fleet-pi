import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus } from "@/lib/app-runtime"
import { getErrorMessage } from "@/lib/pi/server"
import { loadAgentWorkspaceTree } from "@/lib/workspace/server"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export async function workspaceTreeHandler(request: Request) {
  try {
    const context = await resolveWorkspaceContext(request)
    return Response.json(await loadAgentWorkspaceTree(context))
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
      GET: ({ request }) => workspaceTreeHandler(request),
    },
  },
})
