import { createFileRoute } from "@tanstack/react-router"
import { createWorkspaceItemsResponse } from "@/lib/workspace/workspace-query"
import { withWorkspaceQueryHandler } from "@/lib/workspace/workspace-route-handler"

export async function workspaceItemsHandler(
  request = new Request("http://localhost/api/workspace/items")
) {
  return withWorkspaceQueryHandler(request, async (context) =>
    Response.json(await createWorkspaceItemsResponse(context))
  )
}

export const Route = createFileRoute("/api/workspace/items")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceItemsHandler(request),
    },
  },
})
