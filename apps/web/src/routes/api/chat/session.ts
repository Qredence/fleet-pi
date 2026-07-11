import { createFileRoute } from "@tanstack/react-router"
import type { ChatSessionMetadata } from "@workspace/hax-design/lib/pi/chat-protocol"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { deleteOwnedPiSession } from "@/lib/db/pi-session-deletion"
import { hydrateChatSession } from "@/lib/pi/server"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/session")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        wrapApiHandler(async () =>
          withAuthenticatedChatRequest(request, async ({ userId }) => {
            const url = new URL(request.url)
            const metadata: ChatSessionMetadata = {
              sessionFile: url.searchParams.get("sessionFile") ?? undefined,
              sessionId: url.searchParams.get("sessionId") ?? undefined,
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
        ),
      DELETE: async ({ request }) =>
        wrapApiHandler(async () =>
          withAuthenticatedChatRequest(request, async ({ userId }) => {
            if (!userId) {
              return Response.json({ message: "Unauthorized" }, { status: 401 })
            }

            const url = new URL(request.url)
            const sessionId = url.searchParams.get("sessionId") ?? undefined
            const sessionFile = url.searchParams.get("sessionFile") ?? undefined

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
              const status =
                result.reason === "mirror-disabled"
                  ? 501
                  : result.reason === "session-not-owned-or-missing"
                    ? 404
                    : result.reason === "mirror-unavailable"
                      ? 503
                      : 500

              return Response.json(
                {
                  ok: false,
                  reason: result.reason ?? "delete-failed",
                },
                { status }
              )
            }

            return Response.json({
              ok: true,
              sessionId: result.sessionId,
              sessionFile: result.sessionFile,
            })
          })
        ),
    },
  },
})
