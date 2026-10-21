import { createFileRoute } from "@tanstack/react-router"
import { createWorkspaceItemDetailResponse } from "@/lib/workspace/workspace-query"
import { withWorkspaceQueryHandler } from "@/lib/workspace/workspace-route-handler"

export async function workspaceItemHandler(request: Request) {
  return withWorkspaceQueryHandler(request, async (context) => {
    const url = new URL(request.url)
    return Response.json(
      await createWorkspaceItemDetailResponse(
        context,
        url.searchParams.get("id")
      )
    )
  })
}

export const Route = createFileRoute("/api/workspace/item")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceItemHandler(request),
    },
  },
})
