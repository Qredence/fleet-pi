import { createFileRoute } from "@tanstack/react-router"
import {
  ChatModelsDiscoverRequestSchema,
  ChatModelsDiscoverResponseSchema,
} from "@workspace/pi-protocol/chat-protocol.zod"
import { isNamedOccInstanceId } from "@workspace/pi-protocol/provider-catalog"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { getErrorMessage, loadChatModels } from "@/lib/pi/server"
import { getOccInstanceById } from "@/lib/db/occ-instances"

/**
 * Discovers chat models available for the requested provider.
 *
 * Named OCC providers expose their configured model, while other providers
 * expose matching entries from the chat model catalog. Unrecognized providers
 * return a 400 response.
 *
 * @returns An HTTP response containing the provider's available models or an error message.
 */
export async function chatModelsDiscoverHandler(request: Request) {
  return withAuthenticatedChatRequest(request, async ({ userId }) => {
    try {
      const body = ChatModelsDiscoverRequestSchema.parse(await request.json())

      // A named OCC instance: expose only its configured model id (do not
      // ingest full remote /models catalogs for known gateways).
      if (isNamedOccInstanceId(body.providerId)) {
        const instance = await getOccInstanceById(userId, body.providerId)
        if (!instance) {
          return Response.json({ message: "Unknown provider" }, { status: 400 })
        }
        const models = [
          {
            key: `${instance.id}/${instance.modelId}`,
            provider: instance.id,
            id: instance.modelId,
            name: instance.modelId,
            reasoning: false,
            input: ["text" as const],
            available: true,
          },
        ]
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
