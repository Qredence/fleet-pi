import { createFileRoute } from "@tanstack/react-router"
import { loadAgentWorkspaceTree } from "@/lib/workspace/server"
import { getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/workspace/tree")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await loadAgentWorkspaceTree())
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: 500 }
          )
        }
      },
    },
  },
})
