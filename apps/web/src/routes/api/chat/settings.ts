import { createFileRoute } from "@tanstack/react-router"
import { ChatSettingsUpdateRequestSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import {
  getErrorMessage,
  loadChatSettings,
  updateChatSettings,
} from "@/lib/pi/server"

export async function chatSettingsGetHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ userId }) => {
    try {
      return Response.json(
        await loadChatSettings(resolveAppRuntimeContext(), {
          userId,
        })
      )
    } catch (error) {
      return Response.json(
        { message: getErrorMessage(error) },
        { status: getResponseStatus(error) }
      )
    }
  })
}

export async function chatSettingsPatchHandler(request: Request) {
  try {
    return await withAuthenticatedChatRequest(request, async ({ userId }) => {
      const body = ChatSettingsUpdateRequestSchema.parse(await request.json())
      return Response.json(
        await updateChatSettings(resolveAppRuntimeContext(), body.settings, {
          userId,
        })
      )
    })
  } catch (error) {
    return Response.json(
      { message: getErrorMessage(error) },
      { status: getResponseStatus(error) }
    )
  }
}

export const Route = createFileRoute("/api/chat/settings")({
  server: {
    handlers: {
      GET: ({ request }) => chatSettingsGetHandler(request),
      PATCH: ({ request }) => chatSettingsPatchHandler(request),
    },
  },
})
