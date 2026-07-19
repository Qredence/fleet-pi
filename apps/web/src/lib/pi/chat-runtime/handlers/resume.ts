import { ChatSessionMetadataSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { wrapApiHandler } from "@/lib/api-utils"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { hydrateChatSession } from "@/lib/pi/server"

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

      return Response.json(
        await hydrateChatSession(resolveAppRuntimeContext(), metadata, {
          userId,
        })
      )
    })
  )
}
