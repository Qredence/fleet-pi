import { createFileRoute } from "@tanstack/react-router"
import { eraseUserPiData } from "@/lib/db/pi-session-deletion"
import { eraseHostedDurableData } from "@/lib/pi/durable/hosted-agent-turn"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/account")({
  server: {
    handlers: {
      DELETE: async ({ request }) =>
        wrapApiHandler(async () =>
          withAuthenticatedChatRequest(request, async ({ userId }) => {
            if (!userId) {
              return Response.json({ message: "Unauthorized" }, { status: 401 })
            }

            const erased = await eraseUserPiData(userId)
            if (!erased.ok) {
              return Response.json(
                {
                  ok: false,
                  reason: erased.reason,
                  message: "Failed to erase mirrored Pi data.",
                },
                { status: 500 }
              )
            }

            let erasedHosted: boolean
            try {
              erasedHosted = await eraseHostedDurableData(userId)
            } catch {
              return Response.json(
                {
                  ok: false,
                  reason: "hosted_erase_failed",
                  message: "Failed to erase hosted Pi transcripts.",
                },
                { status: 500 }
              )
            }

            return Response.json({
              ok: true,
              scope: erasedHosted ? "pi-mirror+hosted" : "pi-mirror",
              message:
                "Erased Pi sessions and BYOK provider credentials. Better Auth identity rows are unchanged.",
              erasedSessions: erased.erasedSessions,
              erasedProviders: erased.erasedProviders,
              erasedHostedTranscripts: erasedHosted,
            })
          })
        ),
    },
  },
})
