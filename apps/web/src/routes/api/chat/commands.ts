import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus } from "@/lib/app-runtime"
import { getChatAuthSession } from "@/lib/auth/chat-api-auth"
import { loadChatCommands } from "@/lib/pi/runtime/command-catalog"
import { getErrorMessage } from "@/lib/pi/server"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

export const Route = createFileRoute("/api/chat/commands")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const [context, authSession] = await Promise.all([
            resolveWorkspaceContext(request),
            getChatAuthSession(request),
          ])
          return Response.json(
            await loadChatCommands(context, {
              userId: authSession?.user.id,
            })
          )
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
    },
  },
})
