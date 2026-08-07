import {
  isLegacyFleetOccEnabledModelPattern,
  isLegacyFleetOccModelId,
  resolveNeonAiGatewayConfig,
} from "./neon-ai-gateway"
import { hasExplicitOccByok } from "./user-provider-secrets"

/**
 * Drop stale pre-Gateway Pi settings overrides when platform Neon AI Gateway
 * is active so Fleet base defaults (`qwen35-122b-a10b`, `gpt-oss-120b`) apply.
 * Users who saved a complete OpenAI Chat Completions BYOK triple through
 * Settings keep their explicit model configuration — the migration only exists
 * to retire the old platform defaults, not to override deliberate user setup.
 */
export async function migrateLegacyGatewayProjectOverrides(
  overrides: Record<string, unknown>,
  userId: string | undefined
): Promise<Record<string, unknown>> {
  if (!userId || !resolveNeonAiGatewayConfig(userId)) {
    return overrides
  }

  if (await hasExplicitOccByok(userId)) {
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
