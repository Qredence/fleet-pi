import { ChatSessionMetadataSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import type { ChatSessionMetadata } from "@workspace/pi-protocol/chat-protocol"
import { wrapApiHandler } from "@/lib/api-utils"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { createRequestLogger } from "@/lib/logger"

export type ChatSessionAuthorization =
  | { ok: true; metadata: ChatSessionMetadata }
  | { ok: false; response: Response }

/** Parses a chat session request body and enforces session ownership. */
export async function authorizeChatSessionRequest(
  request: Request,
  userId: string | undefined
): Promise<ChatSessionAuthorization> {
  const metadata = ChatSessionMetadataSchema.parse(await request.json())
  const ownership = await enforceChatSessionOwnership({
    sessionId: metadata.sessionId,
    sessionFile: metadata.sessionFile,
    userId,
  })
  if (!ownership.ok) {
    return { ok: false, response: ownership.response }
  }
  return { ok: true, metadata }
}

/**
 * Wraps a session-scoped chat endpoint with request logging, authentication,
 * and session ownership verification.
 */
export async function withAuthorizedChatSessionRequest(
  request: Request,
  handler: (context: {
    log: ReturnType<typeof createRequestLogger>
    metadata: ChatSessionMetadata
    userId: string | undefined
  }) => Promise<Response>
): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  const log = createRequestLogger(requestId)

  return wrapApiHandler(
    async () =>
      withAuthenticatedChatRequest(request, async ({ userId }) => {
        const authorization = await authorizeChatSessionRequest(request, userId)
        if (!authorization.ok) {
          return authorization.response
        }
        return handler({ log, metadata: authorization.metadata, userId })
      }),
    { log }
  )
}
