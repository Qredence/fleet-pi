import { createFileRoute } from "@tanstack/react-router"
import {
  ChatModelsDiscoverRequestSchema,
  ChatModelsDiscoverResponseSchema,
} from "@workspace/pi-protocol/chat-protocol.zod"
import { OPENAI_CHAT_COMPLETIONS_PROVIDER_ID } from "@workspace/pi-protocol/provider-catalog"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage, loadChatModels } from "@/lib/pi/server"
import { discoverOpenAiChatCompletionsModels } from "@/lib/pi/runtime/openai-chat-completions-provider"

export async function chatModelsDiscoverHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ userId }) => {
    try {
      const body = ChatModelsDiscoverRequestSchema.parse(await request.json())

      if (body.providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) {
        const discovered = await discoverOpenAiChatCompletionsModels(userId)
        const models = discovered.map((entry) => ({
          key: `${OPENAI_CHAT_COMPLETIONS_PROVIDER_ID}/${entry.id}`,
          provider: OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
          id: entry.id,
          name: entry.name,
          reasoning: false,
          input: ["text" as const],
          available: true,
        }))
        return Response.json(
          ChatModelsDiscoverResponseSchema.parse({
            providerId: body.providerId,
            models,
          })
        )
      }

      // Other providers: return registry catalog entries for that provider.
      const catalog = await loadChatModels(resolveAppRuntimeContext(), {
        scope: "all",
        userId,
      })
      const models = catalog.models.filter(
        (model) => model.provider === body.providerId
      )
      return Response.json(
        ChatModelsDiscoverResponseSchema.parse({
          providerId: body.providerId,
          models,
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

export const Route = createFileRoute("/api/chat/models/discover")({
  server: {
    handlers: {
      POST: ({ request }) => chatModelsDiscoverHandler(request),
    },
  },
})
