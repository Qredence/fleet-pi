import { createFileRoute } from "@tanstack/react-router"
import { ChatSessionMetadataSchema } from "@workspace/hax-design/lib/pi/chat-protocol.zod"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  enforceChatSessionOwnership,
  requireVercelChatAuth,
} from "@/lib/auth/chat-api-auth"
import { hydrateChatSession } from "@/lib/pi/server"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/resume")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        wrapApiHandler(async () => {
          const authGate = await requireVercelChatAuth(request)
          if (!authGate.ok) {
            return authGate.response
          }

          const metadata = ChatSessionMetadataSchema.parse(await request.json())
          const userId = authGate.authSession?.user.id

          const ownership = await enforceChatSessionOwnership({
            sessionId: metadata.sessionId,
            userId,
          })
          if (!ownership.ok) {
            return ownership.response
          }

          return Response.json(
            await hydrateChatSession(resolveAppRuntimeContext(), metadata)
          )
        }),
    },
  },
})
