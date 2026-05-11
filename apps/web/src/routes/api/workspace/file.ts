import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage } from "@/lib/pi/server"
import {
  WorkspaceFileError,
  loadAgentWorkspaceFile,
} from "@/lib/workspace/server"

export async function workspaceFileHandler(request: Request) {
  const url = new URL(request.url)

  try {
    return Response.json(
      await loadAgentWorkspaceFile(
        resolveAppRuntimeContext(),
        url.searchParams.get("path")
      )
    )
  } catch (error) {
    return Response.json(
      { message: getErrorMessage(error) },
      {
        status:
          error instanceof WorkspaceFileError
            ? error.status
            : getResponseStatus(error),
      }
    )
  }
}

export const Route = createFileRoute("/api/workspace/file")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceFileHandler(request),
    },
  },
})
