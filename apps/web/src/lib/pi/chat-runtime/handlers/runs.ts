import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import {
  ProvenanceQueryApiError,
  createProvenanceErrorResponse,
  createSessionRunsResponse,
  createUnexpectedProvenanceErrorResponse,
} from "@/lib/pi/provenance-query"

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

export async function listChatRunsHandler(request: Request) {
  return withAuthenticatedChatRequest(request, ({ userId }) =>
    chatRunsHandler(request, userId)
  )
}
