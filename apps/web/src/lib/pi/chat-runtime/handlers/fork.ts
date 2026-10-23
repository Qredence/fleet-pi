import { isCloudflareDeployment } from "@/lib/deployment/environment"
import { isLegacyChatSession } from "@/lib/pi/durable/durable-session"
import { forkHostedConversation } from "@/lib/pi/durable/hosted-agent-turn"
import { withAuthorizedChatSessionRequest } from "@/lib/pi/chat-runtime/session-request"

export async function forkChatHandler(request: Request) {
  return withAuthorizedChatSessionRequest(
    request,
    async ({ log, metadata, userId }) => {
      if (
        !isCloudflareDeployment() ||
        isLegacyChatSession(metadata) ||
        !metadata.sessionId
      ) {
        return Response.json(
          { message: "Only a hosted conversation can be forked." },
          { status: 400 }
        )
      }
      if (!userId) {
        return Response.json({ message: "Unauthorized" }, { status: 401 })
      }
      log.info({ sessionId: metadata.sessionId }, "fork request received")
      return forkHostedConversation(userId, metadata.sessionId)
    }
  )
}
