import { OPENAI_CHAT_COMPLETIONS_PROVIDER_ID } from "@workspace/pi-protocol/provider-catalog"
import {
  NEON_AI_GATEWAY_DEFAULT_MODEL,
  isLegacyFleetOccModelId,
  resolveNeonAiGatewayConfig,
} from "./neon-ai-gateway"
import type { AgentSession, AgentSessionServices  } from "@earendil-works/pi-coding-agent"
import type { Model } from "@earendil-works/pi-ai"

type OpenAiCompletionsCompatFlags = {
  supportsStore?: boolean
  maxTokensField?: string
  supportsDeveloperRole?: boolean
}

type SessionWithMutableModel = AgentSession & {
  agent: { state: { model?: Model<any> } }
}

function readOpenAiCompletionsCompat(
  compat: Model<any>["compat"] | undefined
): OpenAiCompletionsCompatFlags | undefined {
  if (!compat || !("supportsStore" in compat)) {
    return undefined
  }
  return compat
}

/**
 * Pi auto-detects "standard" OpenAI-compatible hosts and sends `store: false`
 * plus `max_completion_tokens`. Neon AI Gateway rejects both fields with HTTP
 * 400 (often surfaced as "400 status code (no body)" via the OpenAI SDK).
 */
export const OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT = {
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsStore: false,
  supportsStrictMode: false,
  maxTokensField: "max_tokens" as const,
}

export function mergeOpenAiChatCompletionsGatewayCompat(
  model: Model<any> | undefined
): Model<any> | undefined {
  if (!model || model.provider !== OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) {
    return model
  }

  return {
    ...model,
    // Gateway flags win over any prior model.compat (including Pi auto-detect).
    compat: {
      ...model.compat,
      ...OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT,
    },
  }
}

export function reconcileOpenAiChatCompletionsModel(
  services: AgentSessionServices,
  model: Model<any> | undefined,
  userId?: string
): Model<any> | undefined {
  if (!model || model.provider !== OPENAI_CHAT_COMPLETIONS_PROVIDER_ID) {
    return model
  }

  const gateway = resolveNeonAiGatewayConfig(userId)
  if (!gateway) {
    return services.modelRuntime.getModel(model.provider, model.id) ?? model
  }

  if (isLegacyFleetOccModelId(model.id)) {
    const fallback = services.modelRuntime.getModel(
      model.provider,
      NEON_AI_GATEWAY_DEFAULT_MODEL
    )
    if (fallback) {
      return mergeOpenAiChatCompletionsGatewayCompat(fallback)
    }
  }

  const registered = services.modelRuntime.getModel(model.provider, model.id)
  return mergeOpenAiChatCompletionsGatewayCompat(registered ?? model)
}

export function reconcileRuntimeOccModel(
  runtime: {
    services: AgentSessionServices
    session: AgentSession
  },
  userId?: string
) {
  const current = runtime.session.model
  if (!current) return

  const reconciled = reconcileOpenAiChatCompletionsModel(
    runtime.services,
    current,
    userId
  )
  if (!reconciled) return

  // Remap legacy ids even when compat flags already match (otherwise a session
  // pinned to deepseek-v4-flash-free with Gateway compat still 400s on model id).
  if (
    current.id === reconciled.id &&
    current.provider === reconciled.provider
  ) {
    const currentCompat = readOpenAiCompletionsCompat(current.compat)
    const nextCompat = readOpenAiCompletionsCompat(reconciled.compat)
    if (
      currentCompat?.supportsStore === nextCompat?.supportsStore &&
      currentCompat?.maxTokensField === nextCompat?.maxTokensField &&
      currentCompat?.supportsDeveloperRole === nextCompat?.supportsDeveloperRole
    ) {
      return
    }
  }

  const session = runtime.session as SessionWithMutableModel
  session.agent.state.model = reconciled
}
