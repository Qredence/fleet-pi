import { ChatSessionMetadataSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { wrapApiHandler } from "@/lib/api-utils"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { hydrateChatSession } from "@/lib/pi/server"
import { isCloudflareDeployment } from "@/lib/deployment/environment"
import { isDurableSessionId } from "@/lib/pi/durable/durable-session"
import { readHostedDurableSession } from "@/lib/pi/durable/hosted-agent-turn"

export async function resumeChatHandler(request: Request) {
  return wrapApiHandler(async () =>
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
        isCloudflareDeployment() &&
        userId &&
        isDurableSessionId(metadata.sessionId) &&
        !metadata.sessionFile
      ) {
        const durable = await readHostedDurableSession(
          userId,
          metadata.sessionId
        )
        if (!durable) {
          return Response.json(
            { message: "Session not found" },
            { status: 404 }
          )
        }
        return Response.json(durable)
      }

      return Response.json(
        await hydrateChatSession(resolveAppRuntimeContext(), metadata, {
          userId,
        })
      )
    })
  )
}
