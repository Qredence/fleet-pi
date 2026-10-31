import { createFileRoute } from "@tanstack/react-router"

import { loadAgentWorkspaceTree } from "@/lib/workspace/server"
import { withWorkspaceQueryHandler } from "@/lib/workspace/workspace-route-handler"

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
