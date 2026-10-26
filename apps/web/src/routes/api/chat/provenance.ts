import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "../../../lib/app-runtime"
import {
  createPathProvenanceResponse,
  respondWithProvenanceError,
} from "../../../lib/pi/provenance-query"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { fetchUserSessionIds } from "@/lib/db/pi-session-mirror"
import { isHostedDeployment } from "@/lib/deployment/environment"

export async function chatProvenanceHandler(request: Request, userId?: string) {
  const context = resolveAppRuntimeContext()
  const url = new URL(request.url)
  const allowedSessionIds =
    isHostedDeployment() && userId
      ? new Set(await fetchUserSessionIds(userId))
      : undefined

  try {
    return Response.json(
      createPathProvenanceResponse(
        context,
        url.searchParams.get("path"),
        allowedSessionIds
      )
    )
  } catch (error) {
    return respondWithProvenanceError(error)
  }
}

export const Route = createFileRoute("/api/chat/provenance")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withAuthenticatedChatRequest(request, ({ userId }) =>
          chatProvenanceHandler(request, userId)
        ),
    },
  },
})
