import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage } from "@/lib/pi/server"
import {
  WorkspaceFileError,
  loadAgentWorkspaceFile,
} from "@/lib/workspace/server"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export async function workspaceFileHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async () => {
    const url = new URL(request.url)

    try {
      const context = await resolveWorkspaceContext(request)
      return Response.json(
        await loadAgentWorkspaceFile(context, url.searchParams.get("path"))
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
  })
}

export const Route = createFileRoute("/api/workspace/file")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceFileHandler(request),
    },
  },
})
