import type { ChatSessionMetadata } from "@workspace/pi-protocol/chat-protocol"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { wrapApiHandler } from "@/lib/api-utils"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { deleteOwnedPiSession } from "@/lib/db/pi-session-deletion"
import { hydrateChatSession } from "@/lib/pi/server"

function deleteStatusForReason(reason: string | undefined) {
  switch (reason) {
    case "mirror-disabled":
      return 501
    case "session-not-owned-or-missing":
      return 404
    case "mirror-unavailable":
      return 503
    default:
      return 500
  }
}

export async function getChatSessionHandler(request: Request) {
  return wrapApiHandler(async () =>
    withAuthenticatedChatRequest(request, async ({ userId }) => {
      const params = new URL(request.url).searchParams
      const metadata: ChatSessionMetadata = {
        sessionFile: params.get("sessionFile") ?? undefined,
        sessionId: params.get("sessionId") ?? undefined,
      }
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

export async function deleteChatSessionHandler(request: Request) {
  return wrapApiHandler(async () =>
    withAuthenticatedChatRequest(request, async ({ userId }) => {
      if (!userId) {
        return Response.json({ message: "Unauthorized" }, { status: 401 })
      }

      const params = new URL(request.url).searchParams
      const sessionId = params.get("sessionId") ?? undefined
      const sessionFile = params.get("sessionFile") ?? undefined
      const ownership = await enforceChatSessionOwnership({
        sessionId,
        sessionFile,
        userId,
      })
      if (!ownership.ok) {
        return ownership.response
      }

      const result = await deleteOwnedPiSession({
        sessionId,
        sessionFile,
        userId,
      })

      if (!result.deleted) {
        return Response.json(
          {
            ok: false,
            reason: result.reason ?? "delete-failed",
          },
          { status: deleteStatusForReason(result.reason) }
        )
      }

      return Response.json({
        ok: true,
        sessionId: result.sessionId,
        sessionFile: result.sessionFile,
      })
    })
  )
}
