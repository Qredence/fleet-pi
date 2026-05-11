import { createFileRoute } from "@tanstack/react-router"
import { resolveAppRuntimeContext } from "../../../lib/app-runtime"
import {
  ProvenanceQueryApiError,
  createPathProvenanceResponse,
  createProvenanceErrorResponse,
  createUnexpectedProvenanceErrorResponse,
} from "../../../lib/pi/provenance-query"

export function chatProvenanceHandler(request: Request) {
  const context = resolveAppRuntimeContext()
  const url = new URL(request.url)

  try {
    return Response.json(
      createPathProvenanceResponse(context, url.searchParams.get("path"))
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
      GET: ({ request }) => chatProvenanceHandler(request),
    },
  },
})
