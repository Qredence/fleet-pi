import { createFileRoute } from "@tanstack/react-router"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import {
  createWorkspaceHealthFailure,
  loadAgentWorkspaceHealth,
} from "@/lib/workspace/bootstrap-agent-workspace"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"

export async function workspaceHealthHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async () => {
    try {
      const context = await resolveWorkspaceContext(request)
      return Response.json(await loadAgentWorkspaceHealth(context))
    } catch (error) {
      const context = resolveAppRuntimeContext()
      return Response.json(createWorkspaceHealthFailure(context, error))
    }
  })
}

export const Route = createFileRoute("/api/workspace/health")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceHealthHandler(request),
    },
  },
})
