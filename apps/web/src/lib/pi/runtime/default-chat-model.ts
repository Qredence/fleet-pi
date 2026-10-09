import type { Model } from "@earendil-works/pi-ai"

/**
 * Raised when a chat turn arrives without a model and no model with
 * configured credentials exists, so the server cannot pick one safely.
 */
export class NoChatModelAvailableError extends Error {
  readonly code = "no_chat_model_available"

  constructor(message?: string) {
    super(
      message ??
        "No chat model is available: add an LLM provider in Settings > Providers (or set its env vars) and try again."
    )
    this.name = "NoChatModelAvailableError"
  }
}

export type DefaultChatModelRuntime = {
  getAvailable: () => Promise<ReadonlyArray<Model<any>>>
  hasConfiguredAuth: (provider: string) => boolean
}

export type ResolveDefaultChatModelInput = {
  modelRuntime: DefaultChatModelRuntime
  /** Configured settings default, already resolved to a runtime model (if any). */
  configuredDefault?: Model<any>
  /** Model keys (`provider/id`) the app itself registered (OCC slot, custom providers). */
  preferredKeys?: ReadonlySet<string>
  /** Whether a model passes the user's `enabledModels` patterns. */
  isEnabled?: (model: Model<any>) => boolean
}

const keyOf = (model: Pick<Model<any>, "provider" | "id">) =>
  `${model.provider}/${model.id}`

/**
 * Picks the model for a new chat session when the client sent none.
 *
 * Order: the configured settings default when its provider has auth; else the
 * first authenticated model the app registered and the user enabled; else the
 * first authenticated enabled model; else the first authenticated model. It
 * never falls back to Pi's hard-coded per-provider defaults (e.g.
 * `openai/gpt-5.5`), and throws {@link NoChatModelAvailableError} when no
 * model has configured auth.
 */
export async function resolveDefaultChatModel({
  modelRuntime,
  configuredDefault,
  preferredKeys,
  isEnabled = () => true,
}: ResolveDefaultChatModelInput): Promise<Model<any>> {
  if (
    configuredDefault &&
    modelRuntime.hasConfiguredAuth(configuredDefault.provider)
  ) {
    return configuredDefault
  }

  const authenticated = (await modelRuntime.getAvailable()).filter((model) =>
    modelRuntime.hasConfiguredAuth(model.provider)
  )
  const enabled = authenticated.filter((model) => isEnabled(model))
  const chosen =
    enabled.find((model) => preferredKeys?.has(keyOf(model))) ??
    enabled.at(0) ??
    authenticated.at(0)

  if (!chosen) throw new NoChatModelAvailableError()
  return chosen
}

export type RestorableSessionSource = {
  buildSessionContext: () => {
    messages: ReadonlyArray<unknown>
    model?: { provider: string; modelId: string } | null
  }
}

export type RestorableModelRuntime = {
  getModel: (provider: string, id: string) => Model<any> | undefined
  hasConfiguredAuth: (provider: string) => boolean
}

/**
 * True when Pi will restore the session's own model (existing messages and a
 * recorded model whose provider still has auth). Mirrors Pi's SDK restore
 * check so the server only injects a default for new or unrestorable sessions.
 */
export function sessionHasRestorableModel(
  sessionManager: RestorableSessionSource,
  services: { modelRuntime: RestorableModelRuntime }
): boolean {
  const context = sessionManager.buildSessionContext()
  if (context.messages.length === 0 || !context.model) return false
  const restored = services.modelRuntime.getModel(
    context.model.provider,
    context.model.modelId
  )
  return Boolean(
    restored && services.modelRuntime.hasConfiguredAuth(restored.provider)
  )
}
