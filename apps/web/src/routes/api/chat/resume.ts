import { createFileRoute } from "@tanstack/react-router"
import { ChatSessionMetadataSchema } from "@workspace/hax-design/lib/pi/chat-protocol.zod"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import { hydrateChatSession } from "@/lib/pi/server"
import { wrapApiHandler } from "@/lib/api-utils"

export const Route = createFileRoute("/api/chat/resume")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        wrapApiHandler(async () => {
          const metadata = ChatSessionMetadataSchema.parse(await request.json())
          return Response.json(
            await hydrateChatSession(resolveAppRuntimeContext(), metadata)
          )
        }),
    },
  },
})
