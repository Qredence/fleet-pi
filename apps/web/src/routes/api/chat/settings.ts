import { createFileRoute } from "@tanstack/react-router"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { ChatSettingsUpdateRequestSchema } from "@/lib/pi/chat-protocol.zod"
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
          const body = ChatSettingsUpdateRequestSchema.parse(
            await request.json()
          )
          return Response.json(
            await updateChatSettings(resolveAppRuntimeContext(), body.settings)
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
