import { createFileRoute } from "@tanstack/react-router"
import {
  createWorkspaceHealthFailure,
  loadAgentWorkspaceHealth,
} from "@/lib/workspace/bootstrap-agent-workspace"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export async function workspaceHealthHandler(request: Request) {
  const context = await resolveWorkspaceContext(request)

  try {
    return Response.json(await loadAgentWorkspaceHealth(context))
  } catch (error) {
    return Response.json(createWorkspaceHealthFailure(context, error))
  }
}

export const Route = createFileRoute("/api/workspace/health")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceHealthHandler(request),
    },
  },
})
