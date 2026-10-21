import { withAuthenticatedChatRequest } from "../auth/chat-api-auth"
import { createWorkspaceRouteErrorResponse } from "./workspace-route-errors"
import { resolveWorkspaceContext } from "./workspace-context"
import type { AppRuntimeContext } from "../app-runtime"

/**
 * Authenticate a workspace query route, resolve its runtime context, and map
 * any failure through the shared workspace error envelope.
 */
export function withWorkspaceQueryHandler(
  request: Request,
  respond: (context: AppRuntimeContext) => Promise<Response>
): Promise<Response> {
  return withAuthenticatedChatRequest(request, async ({ authSession }) => {
    let context: AppRuntimeContext | undefined

    try {
      context = await resolveWorkspaceContext(request, authSession?.user)
      return await respond(context)
    } catch (error) {
      return createWorkspaceRouteErrorResponse(error, context)
    }
  })
}
