import { createFileRoute } from "@tanstack/react-router"

import { loadAgentWorkspaceFile } from "@/lib/workspace/server"
import { withWorkspaceQueryHandler } from "@/lib/workspace/workspace-route-handler"

export function workspaceFileHandler(request: Request) {
  return withWorkspaceQueryHandler(request, async (context) => {
    const url = new URL(request.url)
    return Response.json(
      await loadAgentWorkspaceFile(context, url.searchParams.get("path"))
    )
  })
}

export const Route = createFileRoute("/api/workspace/file")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceFileHandler(request),
    },
  },
})
