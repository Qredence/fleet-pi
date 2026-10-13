import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { isCloudflareDeployment } from "@/lib/deployment/environment"
import { createNewChatSession, getErrorMessage } from "@/lib/pi/server"

export async function newChatHandler(request: Request) {
  try {
    return await withAuthenticatedChatRequest(request, async ({ userId }) => {
      if (isCloudflareDeployment()) {
        const now = new Date().toISOString()
        return Response.json({
          session: {
            path: "",
            id: "",
            cwd: "",
            created: now,
            modified: now,
            messageCount: 0,
            firstMessage: "",
          },
          messages: [],
        })
      }
      return Response.json(
        await createNewChatSession(resolveAppRuntimeContext(), { userId })
      )
    })
  } catch (error) {
    return Response.json(
      { message: getErrorMessage(error) },
      { status: getResponseStatus(error) }
    )
  }
}
