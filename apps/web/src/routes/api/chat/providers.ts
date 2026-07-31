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
  isNamedOccInstanceId,
  isOccProviderId,
} from "@workspace/pi-protocol/provider-catalog"
import type { ChatProviderInfo } from "@workspace/pi-protocol/chat-protocol"
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
import {
  allocateOccInstanceId,
  getOccInstanceById,
  listOccInstances,
  removeOccInstance,
  upsertOccInstance,
} from "@/lib/db/occ-instances"
import { refreshSandboxProviderCredentials } from "@/lib/daytona/refresh-sandbox-credentials"
import {
  getProviderConfigStatus,
  hotReloadActiveRuntimesForUser,
  hotReloadProviderAuthForActiveRuntimes,
} from "@/lib/pi/runtime"
import { removeProviderBundle } from "@/lib/pi/runtime/remove-provider-bundle"
import { assertSafeOpenAiCompatibleBaseUrl } from "@/lib/pi/runtime/openai-chat-completions-provider"
import {
  isRemovableCredentialProvider,
  resolveProviderCredentialBundle,
} from "@/lib/pi/runtime/provider-credential-bundle"

/**
 * Combines provider configuration statuses with named OpenAI-compatible instances for an account.
 *
 * @param userId - The account's user identifier, if available.
 * @returns Provider rows including configured named instances.
 */
async function getProviderRows(userId: string | undefined) {
  const base = await getProviderConfigStatus({ userId })
  const instances = await listOccInstances(userId)
  const rows: Array<ChatProviderInfo> = [...base]
  for (const instance of instances) {
    rows.push({
      id: instance.id,
      name: instance.displayName,
      isConfigured: true,
      envVarName: "OPENAI_CHAT_COMPLETIONS_API_KEY",
      providerFamily: OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
      displayName: instance.displayName,
    })
  }
  return rows
}

export const Route = createFileRoute("/api/chat/providers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authSession = await getChatAuthSession(request)

          const providers = await getProviderRows(authSession?.user.id)
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

              const isOccRequest = isOccProviderId(body.providerId)
              // Named-instance path is explicit only: an existing
              // `openai-chat-completions+<slug>` row, or an opt-in create.
              const wantsNamedInstance =
                isNamedOccInstanceId(body.providerId) ||
                body.createOccInstance === true

              // A `displayName` on the reserved default OCC id without the
              // explicit create flag must not silently fork an instance.
              if (
                body.providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID &&
                typeof body.displayName === "string" &&
                body.displayName.trim() !== "" &&
                !wantsNamedInstance
              ) {
                return Response.json(
                  {
                    message:
                      "OCC updates with a display name require an explicit named-instance request (`createOccInstance: true`) or an existing instance id.",
                  },
                  { status: 400 }
                )
              }

              const provider = KNOWN_PROVIDERS.find(
                (p) => p.id === body.providerId
              )
              if (!provider && !isOccRequest) {
                return Response.json(
                  { message: "Unknown provider" },
                  { status: 400 }
                )
              }

              if (provider?.authType === "oauth") {
                return Response.json(
                  {
                    message: `${provider.name} uses OAuth and cannot be configured with an API key here.`,
                  },
                  { status: 400 }
                )
              }

              const apiKey = sanitizeProviderCredentialValue(body.apiKey)

              // OCC (default slot or named instance): requires baseUrl + modelId.
              let baseUrl: string | undefined
              let modelId: string | undefined
              if (isOccRequest) {
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

              if (wantsNamedInstance) {
                const displayName = body.displayName!.trim()
                if (!displayName) {
                  return Response.json(
                    { message: "A display name is required." },
                    { status: 400 }
                  )
                }

                // Update an existing named instance in place (`openai-chat-
                // completions+slug`), else allocate a fresh id from the name.
                const instanceId = isNamedOccInstanceId(body.providerId)
                  ? body.providerId
                  : await allocateOccInstanceId(userId, displayName)

                if (!isVercelDeployment()) {
                  // Local dev stores OCC in env; multi-instance named storage is
                  // a deployed/DB feature.
                  return Response.json(
                    {
                      message:
                        "Named OpenAI-compatible instances require a database-backed account (deployed chat).",
                    },
                    { status: 400 }
                  )
                }

                await upsertOccInstance(
                  userId!,
                  {
                    id: instanceId,
                    displayName,
                    baseUrl: baseUrl!,
                    modelId: modelId!,
                  },
                  apiKey
                )
              } else if (isVercelDeployment()) {
                await storeUserProviderApiKey(userId!, provider!.id, apiKey)
                if (
                  body.providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID &&
                  baseUrl &&
                  modelId
                ) {
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
                  [provider!.envVarName]: apiKey,
                }
                if (
                  body.providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID &&
                  baseUrl &&
                  modelId
                ) {
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

              const updatedProviders = await getProviderRows(userId)

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

              if (isChatAuthRequired() && !userId) {
                return Response.json(
                  { message: "Unauthorized" },
                  { status: 401 }
                )
              }

              const context = resolveAppRuntimeContext()

              if (isNamedOccInstanceId(body.providerId)) {
                if (!isVercelDeployment()) {
                  return Response.json(
                    {
                      message:
                        "Named OpenAI-compatible instances require a database-backed account (deployed chat).",
                    },
                    { status: 400 }
                  )
                }
                const existing = await getOccInstanceById(
                  userId,
                  body.providerId
                )
                if (!existing) {
                  return Response.json(
                    { message: "Unknown provider" },
                    { status: 400 }
                  )
                }
                await removeOccInstance(userId!, body.providerId)
              } else {
                if (!isRemovableCredentialProvider(body.providerId)) {
                  return Response.json(
                    { message: "This provider cannot be removed here." },
                    { status: 400 }
                  )
                }

                const { providerIds } = resolveProviderCredentialBundle(
                  body.providerId
                )

                if (providerIds.length === 0) {
                  return Response.json(
                    { message: "Unknown provider" },
                    { status: 400 }
                  )
                }

                await removeProviderBundle({
                  context,
                  providerId: body.providerId,
                  userId,
                })
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
                  // Sandbox may be offline or disabled; credentials still removed.
                }
              } else {
                await hotReloadProviderAuthForActiveRuntimes()
              }

              const updatedProviders = await getProviderRows(userId)
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
