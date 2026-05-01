import { createFileRoute } from "@tanstack/react-router"
import {
  WorkspaceFileError,
  loadAgentWorkspaceFile,
} from "@/lib/workspace/server"
import { getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/workspace/file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)

        try {
          return Response.json(
            await loadAgentWorkspaceFile(url.searchParams.get("path"))
          )
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            {
              status: error instanceof WorkspaceFileError ? error.status : 500,
            }
          )
        }
      },
    },
  },
})
