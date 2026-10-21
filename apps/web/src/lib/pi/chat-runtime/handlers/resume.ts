import { wrapApiHandler } from "@/lib/api-utils"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { authorizeChatSessionRequest } from "@/lib/pi/chat-runtime/session-request"
import { readOrHydrateSession } from "@/lib/pi/chat-runtime/session-read"

export async function resumeChatHandler(request: Request) {
  return wrapApiHandler(async () =>
    withAuthenticatedChatRequest(request, async ({ userId }) => {
      const authorization = await authorizeChatSessionRequest(request, userId)
      if (!authorization.ok) {
        return authorization.response
      }
      return readOrHydrateSession(userId, authorization.metadata)
    })
  )
}
