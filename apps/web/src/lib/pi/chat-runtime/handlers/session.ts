import type { ChatSessionMetadata } from "@workspace/pi-protocol/chat-protocol"
import { wrapApiHandler } from "@/lib/api-utils"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { deleteOwnedPiSession } from "@/lib/db/pi-session-deletion"
import { isCloudflareDeployment } from "@/lib/deployment/environment"
import { isDurableSessionId } from "@/lib/pi/durable/durable-session"
import { deleteHostedDurableSession } from "@/lib/pi/durable/hosted-agent-turn"
import { readOrHydrateSession } from "@/lib/pi/chat-runtime/session-read"

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

      return readOrHydrateSession(userId, metadata)
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

      if (
        isCloudflareDeployment() &&
        sessionId &&
        isDurableSessionId(sessionId) &&
        !sessionFile
      ) {
        const durableDelete = await deleteHostedDurableSession(
          userId,
          sessionId
        )
        if (!durableDelete.ok) {
          const status = durableDelete.reason === "not-found" ? 404 : 503
          return Response.json(
            {
              ok: false,
              reason:
                durableDelete.reason === "not-found"
                  ? "session-not-owned-or-missing"
                  : "delete-failed",
            },
            { status }
          )
        }
        return Response.json({
          ok: true,
          sessionId,
          sessionFile: undefined,
        })
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
