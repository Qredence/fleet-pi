import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { loadAgentWorkspaceTree } from "@/lib/workspace/server"
import { getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/workspace/tree")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(
            await loadAgentWorkspaceTree(resolveAppRuntimeContext())
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
