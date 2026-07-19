import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage, listChatSessions } from "@/lib/pi/server"

export async function listChatSessionsHandler(request: Request) {
  try {
    return await withAuthenticatedChatRequest(request, async ({ userId }) =>
      Response.json({
        sessions: await listChatSessions(resolveAppRuntimeContext(), {
          userId,
        }),
      })
    )
  } catch (error) {
    return Response.json(
      { message: getErrorMessage(error) },
      { status: getResponseStatus(error) }
    )
  }
}
