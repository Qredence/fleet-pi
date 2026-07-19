import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { createNewChatSession, getErrorMessage } from "@/lib/pi/server"

export async function newChatHandler(request: Request) {
  try {
    return await withAuthenticatedChatRequest(request, async ({ userId }) =>
      Response.json(
        await createNewChatSession(resolveAppRuntimeContext(), { userId })
      )
    )
  } catch (error) {
    return Response.json(
      { message: getErrorMessage(error) },
      { status: getResponseStatus(error) }
    )
  }
}
