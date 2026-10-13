import { OPENAI_CHAT_COMPLETIONS_PROVIDER_ID } from "@workspace/pi-protocol/provider-catalog"
import { isModelPatternEnabled } from "@workspace/pi-protocol/model-patterns"
import {
  NEON_AI_GATEWAY_DEFAULT_MODEL,
  isLegacyFleetOccModelId,
  resolveNeonAiGatewayConfig,
} from "./neon-ai-gateway"

export const OCC_CHAT_PROVIDER = OPENAI_CHAT_COMPLETIONS_PROVIDER_ID

export function isOccChatProviderAlias(provider: string) {
  return provider === OCC_CHAT_PROVIDER || provider === "openai"
}

/**
 * Maps a client model id onto the configured OCC slot ids (gateway defaults,
 * BYOK model list), including legacy Fleet OCC ids when Gateway backs the slot.
 */
export function reconcileOccChatModelId(
  modelId: string,
  modelIds: ReadonlyArray<string>,
  userId?: string
): string | undefined {
  if (modelIds.includes(modelId)) return modelId

  if (resolveNeonAiGatewayConfig(userId) && isLegacyFleetOccModelId(modelId)) {
    if (modelIds.includes(NEON_AI_GATEWAY_DEFAULT_MODEL)) {
      return NEON_AI_GATEWAY_DEFAULT_MODEL
    }
  }

  return undefined
}

export function resolveOccChatModelSelection(
  selection: { provider: string; id: string } | undefined,
  modelIds: ReadonlyArray<string>,
  userId?: string
): string | undefined {
  if (!selection) return modelIds[0]

  const rematched = reconcileOccChatModelId(selection.id, modelIds, userId)
  if (rematched) return rematched

  if (isOccChatProviderAlias(selection.provider)) {
    return modelIds[0]
  }

  if (
    selection.provider === OCC_CHAT_PROVIDER &&
    modelIds.includes(selection.id)
  ) {
    return selection.id
  }

  return undefined
}

export function isEnabledChatModelSelection(
  provider: string,
  modelId: string,
  enabledPatterns: ReadonlyArray<string> | undefined
) {
  if (enabledPatterns === undefined) return true
  if (enabledPatterns.length === 0) return false
  return isModelPatternEnabled(
    {
      id: modelId,
      name: modelId,
      key: `${provider}/${modelId}`,
      provider,
      modelId,
    },
    [...enabledPatterns]
  )
}
