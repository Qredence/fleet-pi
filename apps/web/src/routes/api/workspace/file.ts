import { createFileRoute } from "@tanstack/react-router"
import { withWorkspaceQueryHandler } from "@/lib/workspace/workspace-route-handler"
import { loadAgentWorkspaceFile } from "@/lib/workspace/server"

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
