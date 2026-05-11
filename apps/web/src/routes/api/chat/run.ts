import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "../../../lib/app-runtime"
import {
  ProvenanceQueryApiError,
  createProvenanceErrorResponse,
  createRunDetailResponse,
  createUnexpectedProvenanceErrorResponse,
} from "../../../lib/pi/provenance-query"

export function chatRunHandler(request: Request) {
  const context = resolveAppRuntimeContext()
  const url = new URL(request.url)

  try {
    return Response.json(
      createRunDetailResponse(context, url.searchParams.get("id"))
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

export const Route = createFileRoute("/api/chat/run")({
  server: {
    handlers: {
      GET: ({ request }) => chatRunHandler(request),
    },
  },
})
