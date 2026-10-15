import { ChatSessionMetadataSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import { wrapApiHandler } from "@/lib/api-utils"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { createRequestLogger } from "@/lib/logger"
import { isCloudflareDeployment } from "@/lib/deployment/environment"
import { isLegacyChatSession } from "@/lib/pi/durable/durable-session"
import { forkHostedConversation } from "@/lib/pi/durable/hosted-agent-turn"

export async function forkChatHandler(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  const log = createRequestLogger(requestId)

  return wrapApiHandler(
    async () =>
      withAuthenticatedChatRequest(request, async ({ userId }) => {
        const metadata = ChatSessionMetadataSchema.parse(await request.json())
        const ownership = await enforceChatSessionOwnership({
          sessionId: metadata.sessionId,
          sessionFile: metadata.sessionFile,
          userId,
        })
        if (!ownership.ok) {
          return ownership.response
        }
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
      }),
    { log }
  )
}
