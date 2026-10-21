import { wrapApiHandler } from "@/lib/api-utils"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { createRequestLogger } from "@/lib/logger"
import { isCloudflareDeployment } from "@/lib/deployment/environment"
import { isLegacyChatSession } from "@/lib/pi/durable/durable-session"
import { abortHostedAgentTurn } from "@/lib/pi/durable/hosted-agent-turn"
import { authorizeChatSessionRequest } from "@/lib/pi/chat-runtime/session-request"
import {
  abortActiveSession,
  hasLiveSessionRuntime,
  notLiveSessionResponse,
} from "@/lib/pi/server"

export async function abortChatHandler(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  const log = createRequestLogger(requestId)

  return wrapApiHandler(
    async () =>
      withAuthenticatedChatRequest(request, async ({ userId }) => {
        const authorization = await authorizeChatSessionRequest(request, userId)
        if (!authorization.ok) {
          return authorization.response
        }
        const metadata = authorization.metadata

        log.info({ sessionId: metadata.sessionId }, "abort request received")
        if (isCloudflareDeployment() && !isLegacyChatSession(metadata)) {
          if (!userId) {
            return Response.json({ message: "Unauthorized" }, { status: 401 })
          }
          const response = await abortHostedAgentTurn(userId)
          if (!response.ok) {
            return response
          }
          const body = (await response.json()) as { aborted?: boolean }
          log.info(
            { aborted: body.aborted ?? false },
            "abort request completed"
          )
          return Response.json({ aborted: body.aborted ?? false })
        }
        if (
          isCloudflareDeployment() &&
          !hasLiveSessionRuntime({ ...metadata, userId })
        ) {
          return notLiveSessionResponse()
        }
        const aborted = await abortActiveSession({ ...metadata, userId })
        log.info({ aborted }, "abort request completed")
        return Response.json({ aborted })
      }),
    { log }
  )
}
