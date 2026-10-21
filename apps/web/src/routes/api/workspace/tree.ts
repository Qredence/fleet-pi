import { createFileRoute } from "@tanstack/react-router"
import { withWorkspaceQueryHandler } from "@/lib/workspace/workspace-route-handler"
import { loadAgentWorkspaceTree } from "@/lib/workspace/server"

export function workspaceTreeHandler(request: Request) {
  return withWorkspaceQueryHandler(request, async (context) =>
    Response.json(await loadAgentWorkspaceTree(context))
  )
}

export const Route = createFileRoute("/api/workspace/tree")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceTreeHandler(request),
    },
  },
})
