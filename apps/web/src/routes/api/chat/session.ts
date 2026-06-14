import { createFileRoute } from "@tanstack/react-router"
import type { ChatSessionMetadata } from "@workspace/hax-design/lib/pi/chat-protocol"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { hydrateChatSession } from "@/lib/pi/server"
import { wrapApiHandler } from "@/lib/api-utils"
import { verifySessionOwnership } from "@/lib/db/pi-session-mirror"

export const Route = createFileRoute("/api/chat/session")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        wrapApiHandler(async () => {
          const url = new URL(request.url)
          const metadata: ChatSessionMetadata = {
            sessionFile: url.searchParams.get("sessionFile") ?? undefined,
            sessionId: url.searchParams.get("sessionId") ?? undefined,
          }

          const { auth } = await import("@/lib/auth/server")
          const session = await auth.api.getSession({
            headers: request.headers,
          })
          const userId = session?.user.id

          if (userId && metadata.sessionId) {
            const isOwner = await verifySessionOwnership(
              metadata.sessionId,
              userId
            )
            if (!isOwner) {
              return new Response(
                JSON.stringify({
                  message: "Forbidden: Session belongs to another user",
                }),
                {
                  status: 403,
                  headers: { "Content-Type": "application/json" },
                }
              )
            }
          }

          return Response.json(
            await hydrateChatSession(resolveAppRuntimeContext(), metadata)
          )
        }),
    },
  },
})
