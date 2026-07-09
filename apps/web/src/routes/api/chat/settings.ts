import { createFileRoute } from "@tanstack/react-router"
import { ChatSettingsUpdateRequestSchema } from "@workspace/hax-design/lib/pi/chat-protocol.zod"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { auth } from "@/lib/auth/server"
import {
  getErrorMessage,
  loadChatSettings,
  updateChatSettings,
} from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/settings")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(
            await loadChatSettings(resolveAppRuntimeContext())
          )
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
      PATCH: async ({ request }) => {
        try {
          const authSession = await auth.api
            .getSession({ headers: request.headers })
            .catch(() => null)

          if (process.env.VERCEL === "1" && !authSession?.user.id) {
            return Response.json({ message: "Unauthorized" }, { status: 401 })
          }

          const body = ChatSettingsUpdateRequestSchema.parse(
            await request.json()
          )
          return Response.json(
            await updateChatSettings(
              resolveAppRuntimeContext(),
              body.settings,
              { userId: authSession?.user.id }
            )
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
