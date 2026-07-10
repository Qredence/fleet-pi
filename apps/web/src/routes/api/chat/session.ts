import { createFileRoute } from "@tanstack/react-router"
import type { ChatSessionMetadata } from "@workspace/hax-design/lib/pi/chat-protocol"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
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
              await hydrateChatSession(resolveAppRuntimeContext(), metadata)
            )
          })
        ),
    },
  },
})
