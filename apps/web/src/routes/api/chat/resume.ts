import { createFileRoute } from "@tanstack/react-router"
import type { ChatSessionMetadata } from "@/lib/pi/chat-protocol"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { hydrateChatSession } from "@/lib/pi/server"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/resume")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        wrapApiHandler(async () => {
          const metadata = (await request.json()) as ChatSessionMetadata
          return Response.json(
            await hydrateChatSession(resolveAppRuntimeContext(), metadata)
          )
        }),
    },
  },
})
