import { createFileRoute } from "@tanstack/react-router"
import { loadAgentWorkspaceHealth } from "@/lib/workspace/bootstrap-agent-workspace"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"

function toPublicWorkspaceHealth(
  health: Awaited<ReturnType<typeof loadAgentWorkspaceHealth>>
) {
  return {
    status: health.status,
    workspaceAvailable: health.workspace.available,
    bootstrapComplete: health.bootstrap.complete,
    projectionStatus: health.projection.status,
  }
}

export async function workspaceHealthHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ authSession }) => {
    try {
      const context = await resolveWorkspaceContext(request, authSession?.user)
      return Response.json(
        toPublicWorkspaceHealth(await loadAgentWorkspaceHealth(context))
      )
    } catch {
      return Response.json(
        {
          status: "degraded",
          workspaceAvailable: false,
          bootstrapComplete: false,
          projectionStatus: "degraded",
        },
        { status: 503 }
      )
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
