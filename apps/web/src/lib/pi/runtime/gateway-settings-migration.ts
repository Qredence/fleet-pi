import {
  isLegacyFleetOccEnabledModelPattern,
  isLegacyFleetOccModelId,
  resolveNeonAiGatewayConfig,
} from "./neon-ai-gateway"

/**
 * Drop stale pre-Gateway Pi settings overrides when platform Neon AI Gateway
 * is active so Fleet base defaults (`qwen35-122b-a10b`, `gpt-oss-120b`) apply.
 */
export function migrateLegacyGatewayProjectOverrides(
  overrides: Record<string, unknown>,
  userId: string | undefined
): Record<string, unknown> {
  if (!userId || !resolveNeonAiGatewayConfig(userId)) {
    return overrides
  }

  const next = { ...overrides }
  let changed = false

  const defaultModel = overrides.defaultModel
  if (
    typeof defaultModel === "string" &&
    isLegacyFleetOccModelId(defaultModel)
  ) {
    delete next.defaultModel
    if (next.defaultProvider === "openai-chat-completions") {
      delete next.defaultProvider
    }
    changed = true
  }

  const enabledModels = overrides.enabledModels
  if (Array.isArray(enabledModels) && enabledModels.length > 0) {
    const patterns = enabledModels.filter(
      (item): item is string => typeof item === "string"
    )
    const withoutLegacy = patterns.filter(
      (pattern) => !isLegacyFleetOccEnabledModelPattern(pattern)
    )
    if (withoutLegacy.length !== patterns.length) {
      if (withoutLegacy.length === 0) {
        delete next.enabledModels
      } else {
        next.enabledModels = withoutLegacy
      }
      changed = true
    }
  }

  return changed ? next : overrides
}
