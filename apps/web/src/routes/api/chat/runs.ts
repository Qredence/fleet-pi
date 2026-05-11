import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "../../../lib/app-runtime"
import {
  ProvenanceQueryApiError,
  createProvenanceErrorResponse,
  createSessionRunsResponse,
  createUnexpectedProvenanceErrorResponse,
} from "../../../lib/pi/provenance-query"

export function chatRunsHandler(request: Request) {
  const context = resolveAppRuntimeContext()
  const url = new URL(request.url)

  try {
    return Response.json(
      createSessionRunsResponse(context, {
        sessionId: url.searchParams.get("sessionId"),
        sessionFile: url.searchParams.get("sessionFile"),
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
      GET: ({ request }) => chatRunsHandler(request),
    },
  },
})
