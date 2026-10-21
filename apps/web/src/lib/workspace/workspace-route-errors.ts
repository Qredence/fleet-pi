import {
  RequestContextError,
  getResponseStatus,
  resolveAppRuntimeContext,
} from "../app-runtime"
import {
  WorkspaceQueryApiError,
  createUnexpectedWorkspaceQueryErrorResponse,
} from "./workspace-query"
import { getSafeWorkspaceErrorMessage } from "./workspace-error-messages"
import type { AppRuntimeContext } from "../app-runtime"

/**
 * Map a workspace route failure to its HTTP response: typed query errors keep
 * their status and sanitized body, context errors expose only safe messages,
 * and everything else becomes a generic 500 with server-side logging.
 */
export function createWorkspaceRouteErrorResponse(
  error: unknown,
  context: AppRuntimeContext | undefined
): Response {
  if (error instanceof WorkspaceQueryApiError) {
    return Response.json(error.body, { status: error.status })
  }

  if (error instanceof RequestContextError) {
    return Response.json(
      { message: getSafeWorkspaceErrorMessage(error.message) },
      { status: getResponseStatus(error) }
    )
  }

  return Response.json(
    createUnexpectedWorkspaceQueryErrorResponse(
      context ?? resolveAppRuntimeContext(),
      error
    ),
    { status: 500 }
  )
}
