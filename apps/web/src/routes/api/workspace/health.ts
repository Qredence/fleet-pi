import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  createWorkspaceHealthFailure,
  loadAgentWorkspaceHealth,
} from "@/lib/workspace/bootstrap-agent-workspace"

export async function workspaceHealthHandler() {
  const context = resolveAppRuntimeContext()

  try {
    return Response.json(await loadAgentWorkspaceHealth(context))
  } catch (error) {
    return Response.json(createWorkspaceHealthFailure(context, error))
  }
}

export const Route = createFileRoute("/api/workspace/health")({
  server: {
    handlers: {
      GET: workspaceHealthHandler,
    },
  },
})
