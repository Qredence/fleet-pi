import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { createNewChatSession, getErrorMessage } from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/new")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { auth } = await import("@/lib/auth/server")
          const session = await auth.api.getSession({
            headers: request.headers,
          })
          const userId = session?.user.id

          return Response.json(
            await createNewChatSession(resolveAppRuntimeContext(), { userId })
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
