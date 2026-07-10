import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "../../../lib/app-runtime"
import {
  ProvenanceQueryApiError,
  createProvenanceErrorResponse,
  createSessionRunsResponse,
  createUnexpectedProvenanceErrorResponse,
} from "../../../lib/pi/provenance-query"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"

export async function chatRunsHandler(request: Request, userId?: string) {
  const context = resolveAppRuntimeContext()
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("sessionId") ?? undefined
  const sessionFile = url.searchParams.get("sessionFile") ?? undefined

  const ownership = await enforceChatSessionOwnership({
    sessionId,
    sessionFile,
    userId,
  })
  if (!ownership.ok) {
    return ownership.response
  }

  try {
    return Response.json(
      createSessionRunsResponse(context, {
        sessionId,
        sessionFile,
      })
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

export const Route = createFileRoute("/api/chat/runs")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withAuthenticatedChatRequest(request, ({ userId }) =>
          chatRunsHandler(request, userId)
        ),
    },
  },
})
