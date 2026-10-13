import { createFileRoute } from "@tanstack/react-router"
import {
  ChatModelsDiscoverRequestSchema,
  ChatModelsDiscoverResponseSchema,
} from "@workspace/pi-protocol/chat-protocol.zod"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage, loadChatModels } from "@/lib/pi/server"
import { discoverConfiguredProviderModels } from "@/lib/pi/runtime/discover-provider-models"

/**
 * Discovers chat models available for the requested provider.
 *
 * Custom providers load `GET {baseUrl}/models` and keep the models that wire
 * can call. OpenAI Chat Completions stays on its configured model ids.
 * Other providers expose matching entries from the chat model catalog.
 * Unknown custom providers return 400.
 *
 * @returns An HTTP response containing the provider's available models or an error message.
 */
export async function chatModelsDiscoverHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ userId }) => {
    try {
      const body = ChatModelsDiscoverRequestSchema.parse(await request.json())
      const discovered = await discoverConfiguredProviderModels(
        userId,
        body.providerId
      )
      switch (discovered.status) {
        case "unknown":
          return Response.json({ message: "Unknown provider" }, { status: 400 })
        case "models":
          return Response.json(
            ChatModelsDiscoverResponseSchema.parse({
              providerId: body.providerId,
              models: discovered.models,
            })
          )
        case "skip":
          break
        default: {
          const exhaustive: never = discovered
          return exhaustive
        }
      }

      // Built-in providers: return registry catalog entries for that provider.
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
