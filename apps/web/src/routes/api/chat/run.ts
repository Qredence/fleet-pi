import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "../../../lib/app-runtime"
import {
  ProvenanceQueryApiError,
  createProvenanceErrorResponse,
  createRunDetailResponse,
  createUnexpectedProvenanceErrorResponse,
} from "../../../lib/pi/provenance-query"
import {
  enforceRunOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"

export async function chatRunHandler(request: Request, userId?: string) {
  const context = resolveAppRuntimeContext()
  const url = new URL(request.url)
  const runId = url.searchParams.get("id") ?? undefined

  const ownership = await enforceRunOwnership({ runId, userId })
  if (!ownership.ok) {
    return ownership.response
  }

  try {
    return Response.json(createRunDetailResponse(context, runId ?? null))
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

export const Route = createFileRoute("/api/chat/run")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withAuthenticatedChatRequest(request, ({ userId }) =>
          chatRunHandler(request, userId)
        ),
    },
  },
})
