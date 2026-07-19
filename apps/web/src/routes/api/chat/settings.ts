import { createFileRoute } from "@tanstack/react-router"
import { ChatSettingsUpdateRequestSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  getChatAuthSession,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import {
  getErrorMessage,
  loadChatSettings,
  updateChatSettings,
} from "@/lib/pi/server"

export const Route = createFileRoute("/api/chat/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authSession = await getChatAuthSession(request)
          return Response.json(
            await loadChatSettings(resolveAppRuntimeContext(), {
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
      PATCH: async ({ request }) => {
        try {
          return await withAuthenticatedChatRequest(
            request,
            async ({ userId }) => {
              const body = ChatSettingsUpdateRequestSchema.parse(
                await request.json()
              )
              return Response.json(
                await updateChatSettings(
                  resolveAppRuntimeContext(),
                  body.settings,
                  { userId }
                )
              )
            }
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
