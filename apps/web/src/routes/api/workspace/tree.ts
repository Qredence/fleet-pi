import { createFileRoute } from "@tanstack/react-router"
import {
  getResponseStatus,
  resolveAppRuntimeContext,
} from "@/lib/desktop/server"
import { loadAgentWorkspaceTree } from "@/lib/workspace/server"
import { getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/workspace/tree")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return Response.json(
            await loadAgentWorkspaceTree(resolveAppRuntimeContext(request))
          )
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
    },
  },
})
