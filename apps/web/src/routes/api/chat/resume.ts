import { createFileRoute } from "@tanstack/react-router"
import { ChatSessionMetadataSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { hydrateChatSession } from "@/lib/pi/server"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/resume")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        wrapApiHandler(async () =>
          withAuthenticatedChatRequest(request, async ({ userId }) => {
            const metadata = ChatSessionMetadataSchema.parse(
              await request.json()
            )

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
    },
  },
})
