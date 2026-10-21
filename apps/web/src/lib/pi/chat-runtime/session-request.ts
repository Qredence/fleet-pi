import { ChatSessionMetadataSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import type { ChatSessionMetadata } from "@workspace/pi-protocol/chat-protocol"
import { enforceChatSessionOwnership } from "@/lib/auth/chat-api-auth"

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
