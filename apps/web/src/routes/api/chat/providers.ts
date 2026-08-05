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
  isCustomProviderId,
  isNamedOccInstanceId,
  isOccFamilyApi,
  toCustomProviderId,
  toOccInstanceId,
} from "@workspace/pi-protocol/provider-catalog"
import type {
  ChatProviderInfo,
  ChatProviderUpdateRequest,
  PiCustomProviderApi,
} from "@workspace/pi-protocol/chat-protocol"
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
  createLocalProviderInstance,
  getLocalProviderInstance,
  listLocalProviderInstancesWithApiKey,
  removeLocalProviderInstance,
  upsertLocalProviderInstance,
  useLocalProviderStore,
} from "@/lib/db/local-provider-instances"
import {
  allocateCustomProviderId,
  allocateOccInstanceId,
  getOccInstanceById,
  listOccInstancesWithApiKey,
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
import { assertCustomProviderBaseUrl } from "@/lib/pi/runtime/openai-chat-completions-url"
import {
  isRemovableCredentialProvider,
  resolveProviderCredentialBundle,
} from "@/lib/pi/runtime/provider-credential-bundle"

/**
 * Combines provider configuration statuses with custom provider instances
 * (legacy named OCC + general custom) for an account.
 *
 * @param userId - The account's user identifier, if available.
 * @returns Provider rows including configured custom instances.
 */
async function getProviderRows(userId: string | undefined) {
  const base = await getProviderConfigStatus({ userId })
  // One query + one decrypt pass for DB-backed accounts; local anonymous/dev
  // accounts read the gitignored file store. DB errors propagate (route returns
  // 500) instead of a misleading "not configured" row.
  const instances = useLocalProviderStore(userId)
    ? await listLocalProviderInstancesForRoute(userId)
    : await listOccInstancesWithApiKey(userId)
  const rows: Array<ChatProviderInfo> = [...base]
  for (const instance of instances) {
    rows.push({
      id: instance.id,
      name: instance.displayName,
      isConfigured: isInstanceUsable(instance),
      envVarName: "OPENAI_CHAT_COMPLETIONS_API_KEY",
      providerFamily: OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
      displayName: instance.displayName,
      api: instance.api,
      modelIds: instance.modelIds,
    })
  }
  return rows
}

/**
 * A malformed/unreadable local store must not 500 the Settings providers list
 * (the UI is how users fix or remove broken instances); degrade to "no
 * instances" with a diagnostic, matching the registration path. DB errors on
 * the Postgres branch still propagate.
 */
async function listLocalProviderInstancesForRoute(userId: string | undefined) {
  try {
    return await listLocalProviderInstancesWithApiKey(userId)
  } catch (error) {
    console.warn(
      `Ignoring unreadable local provider store for providers list: ${getErrorMessage(error)}`
    )
    return []
  }
}

/** Configured only when the api key is present and the base URL validates. */
function isInstanceUsable(instance: {
  apiKey: string
  baseUrl: string
  api?: PiCustomProviderApi
}): boolean {
  if (!instance.apiKey) return false
  try {
    assertCustomProviderBaseUrl(
      instance.api ?? "openai-completions",
      instance.baseUrl
    )
    return true
  } catch {
    return false
  }
}

const jsonError = (message: string, status = 400) =>
  Response.json({ message }, { status })

/**
 * Create or update a custom provider instance (legacy named OCC or general
 * custom). Values are fully validated up front so the body carries no
 * non-null assertions downstream.
 */
async function handleCustomProviderUpsert(
  userId: string | undefined,
  body: {
    providerId: string
    apiKey: string
    baseUrl?: string
    modelId?: string
    displayName?: string
    api?: PiCustomProviderApi
    models?: Array<string>
  },
  provider: (typeof KNOWN_PROVIDERS)[number] | undefined
) {
  const displayName = body.displayName?.trim() ?? ""
  if (!displayName) {
    return jsonError("A display name is required.")
  }

  if (provider?.authType === "oauth") {
    return jsonError(
      `${provider.name} uses OAuth and cannot be configured with an API key here.`
    )
  }

  const api: PiCustomProviderApi = body.api ?? "openai-completions"

  // Named OCC targets: an existing `openai-chat-completions+<slug>` id, or a
  // create against the reserved OCC id. Their `openai-chat-completions+`
  // prefix promises OpenAI-compatible semantics, so non-OCC APIs are rejected.
  const isNamedOccTarget =
    isNamedOccInstanceId(body.providerId) ||
    body.providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID
  if (isNamedOccTarget && !isOccFamilyApi(api)) {
    return jsonError(
      "Named OpenAI Chat Completions instances only support OpenAI-compatible APIs."
    )
  }

  let baseUrl: string
  try {
    // Single policy entry point: OCC-family endpoints normalize OpenAI paths
    // and may use loopback http in local dev; everything else is https-only.
    baseUrl = assertCustomProviderBaseUrl(api, body.baseUrl ?? "")
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid provider base URL."
    )
  }

  const models = (body.models ?? [])
    .map((model) => sanitizeProviderCredentialValue(model))
    .filter((model): model is string => Boolean(model))
  // Back-compat: the single-model quick-add path sends `modelId` only.
  if (models.length === 0) {
    const modelId = sanitizeProviderCredentialValue(body.modelId ?? "")
    if (modelId) models.push(modelId)
  }
  if (models.length === 0) {
    return jsonError(
      "Custom providers require apiKey, baseUrl, and at least one model."
    )
  }

  const apiKey = sanitizeProviderCredentialValue(body.apiKey)
  if (!apiKey) {
    return jsonError("API key is required.")
  }

  if (isChatAuthRequired() && !userId) {
    return jsonError("Unauthorized", 401)
  }

  // Local anonymous/dev instances live in a gitignored file store; deployed
  // and DB-backed accounts use `pi_user_providers`.
  const useLocalStore = useLocalProviderStore(userId)

  const instanceBody = {
    displayName,
    baseUrl,
    api,
    modelIds: models,
  }

  // Update an existing instance in place (`openai-chat-completions+<slug>` or
  // `custom+<slug>`). Otherwise allocate a fresh id from the display name:
  // creates against the reserved OCC id keep the legacy
  // `openai-chat-completions+` namespace, everything else gets `custom+`.
  const isExistingInstance =
    isNamedOccInstanceId(body.providerId) || isCustomProviderId(body.providerId)

  let instanceId = body.providerId
  if (!isExistingInstance) {
    instanceId = useLocalStore
      ? await createLocalProviderInstance(
          userId,
          instanceBody,
          isNamedOccTarget ? toOccInstanceId : toCustomProviderId,
          apiKey
        )
      : isNamedOccTarget
        ? await allocateOccInstanceId(userId, displayName)
        : await allocateCustomProviderId(userId, displayName)
  }

  if (useLocalStore) {
    // Brand-new local instances were already persisted by
    // `createLocalProviderInstance`; only updates need a separate write.
    if (isExistingInstance) {
      await upsertLocalProviderInstance(
        userId,
        { ...instanceBody, id: instanceId },
        apiKey
      )
    }
  } else {
    await upsertOccInstance(
      userId!,
      { ...instanceBody, id: instanceId },
      apiKey
    )
  }

  const context = resolveAppRuntimeContext()
  await hotReloadActiveRuntimesForUserSafe(userId, context.projectRoot)

  const updatedProviders = await getProviderRows(userId)
  return Response.json(
    ChatProviderUpdateResponseSchema.parse({
      success: true,
      providers: updatedProviders,
      reloadRequired: false,
    })
  )
}

async function hotReloadActiveRuntimesForUserSafe(
  userId: string | undefined,
  projectRoot: string
) {
  if (userId) {
    await hotReloadActiveRuntimesForUser(userId, undefined, projectRoot)
    try {
      await refreshSandboxProviderCredentials(userId)
    } catch {
      // Sandbox may be offline or disabled; credentials still saved.
    }
  } else {
    await hotReloadProviderAuthForActiveRuntimes()
  }
}

/**
 * Configures a catalog provider with an API key (and, for the default OCC
 * slot, a base URL + model id). Persists to `pi_user_providers` on Vercel or
 * the gitignored `.env.local` locally, then hot-reloads the user's active
 * runtimes.
 */
async function handleDefaultProviderUpsert(
  userId: string | undefined,
  body: ChatProviderUpdateRequest,
  provider: (typeof KNOWN_PROVIDERS)[number]
): Promise<Response> {
  const apiKey = sanitizeProviderCredentialValue(body.apiKey)

  // OCC default slot: requires baseUrl + modelId.
  let baseUrl: string | undefined
  let modelId: string | undefined
  if (body.providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) {
    try {
      baseUrl = assertSafeOpenAiCompatibleBaseUrl(body.baseUrl ?? "")
    } catch (error) {
      return jsonError(
        error instanceof Error
          ? error.message
          : "Invalid OpenAI Chat Completions base URL."
      )
    }
    modelId = sanitizeProviderCredentialValue(body.modelId ?? "")
    if (!baseUrl || !modelId) {
      return jsonError(
        "OpenAI Chat Completions requires apiKey, baseUrl, and modelId."
      )
    }
  }

  if (!apiKey) {
    return jsonError("API key is required.")
  }

  if (isChatAuthRequired() && !userId) {
    return jsonError("Unauthorized", 401)
  }

  const context = resolveAppRuntimeContext()

  if (isVercelDeployment()) {
    await storeUserProviderApiKey(userId!, provider.id, apiKey)
    if (baseUrl && modelId) {
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
    if (baseUrl && modelId) {
      const baseUrlProvider = KNOWN_PROVIDERS.find(
        (entry) => entry.id === OPENAI_CHAT_COMPLETIONS_BASE_URL_PROVIDER_ID
      )
      const modelProvider = KNOWN_PROVIDERS.find(
        (entry) => entry.id === OPENAI_CHAT_COMPLETIONS_MODEL_PROVIDER_ID
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

  await hotReloadActiveRuntimesForUserSafe(userId, context.projectRoot)

  const updatedProviders = await getProviderRows(userId)
  return Response.json(
    ChatProviderUpdateResponseSchema.parse({
      success: true,
      providers: updatedProviders,
      reloadRequired: false,
    })
  )
}

type ProviderServerHandlerInput = { request: Request }
type ProviderServerHandler = (
  input: ProviderServerHandlerInput
) => Promise<Response>

/**
 * Exported separately from the route so tests can invoke the handlers without
 * going through TanStack Start's file-route transform.
 */
export const providersServerHandlers: {
  GET: ProviderServerHandler
  POST: ProviderServerHandler
  DELETE: ProviderServerHandler
} = {
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
      return await withAuthenticatedChatRequest(request, async ({ userId }) => {
        const rawBody = await request.json()
        const body = ChatProviderUpdateRequestSchema.parse(rawBody)

        // Instance path is explicit only: an existing
        // `openai-chat-completions+<slug>` or `custom+<slug>` row, or an
        // opt-in create.
        const wantsNamedInstance =
          isNamedOccInstanceId(body.providerId) ||
          isCustomProviderId(body.providerId) ||
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

        const provider = KNOWN_PROVIDERS.find((p) => p.id === body.providerId)

        if (wantsNamedInstance) {
          return await handleCustomProviderUpsert(userId, body, provider)
        }

        if (!provider) {
          return jsonError("Unknown provider")
        }

        if (provider.authType === "oauth") {
          return jsonError(
            `${provider.name} uses OAuth and cannot be configured with an API key here.`
          )
        }

        return await handleDefaultProviderUpsert(userId, body, provider)
      })
    } catch (error) {
      return Response.json(
        { message: getErrorMessage(error) },
        { status: getResponseStatus(error) }
      )
    }
  },
  DELETE: async ({ request }) => {
    try {
      return await withAuthenticatedChatRequest(request, async ({ userId }) => {
        const rawBody = await request.json()
        const body = ChatProviderRemoveRequestSchema.parse(rawBody)

        if (isChatAuthRequired() && !userId) {
          return Response.json({ message: "Unauthorized" }, { status: 401 })
        }

        const context = resolveAppRuntimeContext()

        if (
          isNamedOccInstanceId(body.providerId) ||
          isCustomProviderId(body.providerId)
        ) {
          if (useLocalProviderStore(userId)) {
            const existing = await getLocalProviderInstance(
              userId,
              body.providerId
            )
            if (!existing) {
              return Response.json(
                { message: "Unknown provider" },
                { status: 400 }
              )
            }
            await removeLocalProviderInstance(userId, body.providerId)
          } else {
            const existing = await getOccInstanceById(userId, body.providerId)
            if (!existing) {
              return Response.json(
                { message: "Unknown provider" },
                { status: 400 }
              )
            }
            await removeOccInstance(userId!, body.providerId)
          }
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

        await hotReloadActiveRuntimesForUserSafe(userId, context.projectRoot)

        const updatedProviders = await getProviderRows(userId)
        const response = ChatProviderUpdateResponseSchema.parse({
          success: true,
          providers: updatedProviders,
          reloadRequired: false,
        })
        return Response.json(response)
      })
    } catch (error) {
      return Response.json(
        { message: getErrorMessage(error) },
        { status: getResponseStatus(error) }
      )
    }
  },
}

export const Route = createFileRoute("/api/chat/providers")({
  server: { handlers: providersServerHandlers },
})
