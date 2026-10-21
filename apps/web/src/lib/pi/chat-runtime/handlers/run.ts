import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  enforceRunOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import {
  createRunDetailResponse,
  respondWithProvenanceError,
} from "@/lib/pi/provenance-query"

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
    return respondWithProvenanceError(error)
  }
}

export async function getChatRunHandler(request: Request) {
  return withAuthenticatedChatRequest(request, ({ userId }) =>
    chatRunHandler(request, userId)
  )
}
