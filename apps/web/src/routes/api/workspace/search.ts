import { createFileRoute } from "@tanstack/react-router"
import { createWorkspaceSearchResponse } from "@/lib/workspace/workspace-query"
import { withWorkspaceQueryHandler } from "@/lib/workspace/workspace-route-handler"

export async function workspaceSearchHandler(request: Request) {
  return withWorkspaceQueryHandler(request, async (context) => {
    const url = new URL(request.url)
    return Response.json(
      await createWorkspaceSearchResponse(context, url.searchParams.get("q"))
    )
  })
}

export const Route = createFileRoute("/api/workspace/search")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceSearchHandler(request),
    },
  },
})
