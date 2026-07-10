import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "../../../lib/app-runtime"
import {
  ProvenanceQueryApiError,
  createPathProvenanceResponse,
  createProvenanceErrorResponse,
  createUnexpectedProvenanceErrorResponse,
} from "../../../lib/pi/provenance-query"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { fetchUserSessionIds } from "@/lib/db/pi-session-mirror"
import { isVercelDeployment } from "@/lib/deployment"

export async function chatProvenanceHandler(request: Request, userId?: string) {
  const context = resolveAppRuntimeContext()
  const url = new URL(request.url)
  const allowedSessionIds =
    isVercelDeployment() && userId
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
    if (error instanceof ProvenanceQueryApiError) {
      return Response.json(
        createProvenanceErrorResponse(error.code, error.message),
        { status: error.status }
      )
    }

    return Response.json(createUnexpectedProvenanceErrorResponse(error), {
      status: 500,
    })
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
