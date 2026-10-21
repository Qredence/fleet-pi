import {
  RequestContextError,
  getResponseStatus,
  resolveAppRuntimeContext,
} from "../app-runtime"
import { getErrorMessage } from "../pi/server"
import {
  WorkspaceQueryApiError,
  createUnexpectedWorkspaceQueryErrorResponse,
} from "./workspace-query"
import type { AppRuntimeContext } from "../app-runtime"

/**
 * Map a workspace route failure to its HTTP response: typed query errors keep
 * their status and body, context errors expose their message and status, and
 * everything else becomes a 500 with runtime diagnostics.
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
      { message: getErrorMessage(error) },
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
