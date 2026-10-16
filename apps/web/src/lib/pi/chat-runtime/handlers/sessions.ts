import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { isCloudflareDeployment } from "@/lib/deployment/environment"
import {
  listHostedDurableSessions,
  mergeDurableSessions,
} from "@/lib/pi/durable/hosted-agent-turn"
import { getErrorMessage, listChatSessions } from "@/lib/pi/server"

export async function listChatSessionsHandler(request: Request) {
  try {
    return await withAuthenticatedChatRequest(request, async ({ userId }) => {
      const sessions = await listChatSessions(resolveAppRuntimeContext(), {
        userId,
      })
      const durable =
        isCloudflareDeployment() && userId
          ? await listHostedDurableSessions(userId)
          : []
      return Response.json({
        sessions: mergeDurableSessions(sessions, durable),
      })
    })
  } catch (error) {
    return Response.json(
      { message: getErrorMessage(error) },
      { status: getResponseStatus(error) }
    )
  }
}
