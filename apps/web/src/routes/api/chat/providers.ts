import { createFileRoute } from "@tanstack/react-router"
import {
  ChatProviderRemoveRequestSchema,
  ChatProviderUpdateRequestSchema,
  ChatProviderUpdateResponseSchema,
} from "@workspace/pi-protocol/chat-protocol.zod"
import {
  KNOWN_PROVIDERS,
  OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
} from "@workspace/pi-protocol/provider-catalog"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage } from "@/lib/pi/server"
import {
  sanitizeProviderCredentialValue,
  updateEnvVars,
} from "@/lib/env-manager"
import {
  getChatAuthSession,
  isChatAuthRequired,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { isVercelDeployment } from "@/lib/deployment/environment"
import { storeUserProviderApiKey } from "@/lib/db/user-providers"
import { refreshSandboxProviderCredentials } from "@/lib/daytona/refresh-sandbox-credentials"
import {
  getProviderConfigStatus,
  hotReloadActiveRuntimesForUser,
  hotReloadProviderAuthForActiveRuntimes,
} from "@/lib/pi/runtime"
import { ensureOpenAiChatCompletionsModelEnabled } from "@/lib/pi/runtime/ensure-openai-chat-completions-model"
import { removeProviderBundle } from "@/lib/pi/runtime/remove-provider-bundle"
import { assertSafeOpenAiCompatibleBaseUrl } from "@/lib/pi/runtime/openai-chat-completions-provider"
import {
  isRemovableCredentialProvider,
  resolveProviderCredentialBundle,
} from "@/lib/pi/runtime/provider-credential-bundle"

export const Route = createFileRoute("/api/chat/providers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authSession = await getChatAuthSession(request)

          const providers = await getProviderConfigStatus({
            userId: authSession?.user.id,
          })
          return Response.json({ providers })
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
      POST: async ({ request }) => {
        try {
          return await withAuthenticatedChatRequest(
            request,
            async ({ userId }) => {
              const rawBody = await request.json()
              const body = ChatProviderUpdateRequestSchema.parse(rawBody)
              const provider = KNOWN_PROVIDERS.find(
                (p) => p.id === body.providerId
              )
              if (!provider) {
                return Response.json(
                  { message: "Unknown provider" },
                  { status: 400 }
                )
              }

              if (provider.authType === "oauth") {
                return Response.json(
                  {
                    message: `${provider.name} uses OAuth and cannot be configured with an API key here.`,
                  },
                  { status: 400 }
                )
              }

              const apiKey = sanitizeProviderCredentialValue(body.apiKey)
              const isOpenAiChatCompletions =
                body.providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID

              let baseUrl: string | undefined
              let modelId: string | undefined
              if (isOpenAiChatCompletions) {
                try {
                  baseUrl = assertSafeOpenAiCompatibleBaseUrl(
                    body.baseUrl ?? ""
                  )
                } catch (error) {
                  return Response.json(
                    {
                      message:
                        error instanceof Error
                          ? error.message
                          : "Invalid OpenAI Chat Completions base URL.",
                    },
                    { status: 400 }
                  )
                }
                modelId = sanitizeProviderCredentialValue(body.modelId ?? "")
                if (!baseUrl || !modelId) {
                  return Response.json(
                    {
                      message:
                        "OpenAI Chat Completions requires apiKey, baseUrl, and modelId.",
                    },
                    { status: 400 }
                  )
                }
              }

              if (!apiKey) {
                return Response.json(
                  { message: "API key is required." },
                  { status: 400 }
                )
              }

              const context = resolveAppRuntimeContext()

              if (isChatAuthRequired() && !userId) {
                return Response.json(
                  { message: "Unauthorized" },
                  { status: 401 }
                )
              }

              if (isVercelDeployment()) {
                await storeUserProviderApiKey(userId!, provider.id, apiKey)
                if (isOpenAiChatCompletions && baseUrl && modelId) {
                  await storeUserProviderApiKey(
                    userId!,
                    OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID,
                    baseUrl
                  )
                  await storeUserProviderApiKey(
                    userId!,
                    OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID,
                    modelId
                  )
                }
              } else {
                const envEntries: Record<string, string> = {
                  [provider.envVarName]: apiKey,
                }
                if (isOpenAiChatCompletions && baseUrl && modelId) {
                  const baseUrlProvider = KNOWN_PROVIDERS.find(
                    (entry) =>
                      entry.id === OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
                  )
                  const modelProvider = KNOWN_PROVIDERS.find(
                    (entry) =>
                      entry.id === OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID
                  )
                  if (baseUrlProvider) {
                    envEntries[baseUrlProvider.envVarName] = baseUrl
                  }
                  if (modelProvider) {
                    envEntries[modelProvider.envVarName] = modelId
                  }
                }
                // Vite ignores .env.local watches; await durable persistence so
                // success means credentials are on disk (temp file + rename).
                await updateEnvVars(context.projectRoot, envEntries)
              }

              if (isOpenAiChatCompletions && modelId) {
                await ensureOpenAiChatCompletionsModelEnabled(
                  context,
                  modelId,
                  {
                    userId,
                    skipSettingsHotReload: true,
                  }
                )
              }

              if (userId) {
                await hotReloadActiveRuntimesForUser(
                  userId,
                  undefined,
                  context.projectRoot
                )
                try {
                  await refreshSandboxProviderCredentials(userId)
                } catch {
                  // Sandbox may be offline or disabled; credentials still saved.
                }
              } else {
                await hotReloadProviderAuthForActiveRuntimes()
              }

              const updatedProviders = await getProviderConfigStatus({ userId })

              const response = ChatProviderUpdateResponseSchema.parse({
                success: true,
                providers: updatedProviders,
                reloadRequired: false,
              })
              return Response.json(response)
            }
          )
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
      DELETE: async ({ request }) => {
        try {
          return await withAuthenticatedChatRequest(
            request,
            async ({ userId }) => {
              const rawBody = await request.json()
              const body = ChatProviderRemoveRequestSchema.parse(rawBody)
              if (!isRemovableCredentialProvider(body.providerId)) {
                return Response.json(
                  { message: "This provider cannot be removed here." },
                  { status: 400 }
                )
              }

              const context = resolveAppRuntimeContext()
              const { providerIds } = resolveProviderCredentialBundle(
                body.providerId
              )

              if (providerIds.length === 0) {
                return Response.json(
                  { message: "Unknown provider" },
                  { status: 400 }
                )
              }

              if (isChatAuthRequired() && !userId) {
                return Response.json(
                  { message: "Unauthorized" },
                  { status: 401 }
                )
              }

              await removeProviderBundle({
                context,
                providerId: body.providerId,
                userId,
              })

              if (userId) {
                await hotReloadActiveRuntimesForUser(
                  userId,
                  undefined,
                  context.projectRoot
                )
                try {
                  await refreshSandboxProviderCredentials(userId)
                } catch {
                  // Sandbox may be offline or disabled; credentials still removed.
                }
              } else {
                await hotReloadProviderAuthForActiveRuntimes()
              }

              const updatedProviders = await getProviderConfigStatus({ userId })
              const response = ChatProviderUpdateResponseSchema.parse({
                success: true,
                providers: updatedProviders,
                reloadRequired: false,
              })
              return Response.json(response)
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
