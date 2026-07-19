import { stripThinkingLevel } from "@workspace/pi-protocol/model-patterns"
import { resolveProviderCredentialBundle } from "./provider-credential-bundle"

export function cleanupProjectSettingsForRemovedProvider(
  overrides: Record<string, unknown>,
  providerId: string
) {
  const { providerIds } = resolveProviderCredentialBundle(providerId)
  const removedIds = new Set(providerIds)
  const next = { ...overrides }

  const defaultProvider = next.defaultProvider
  if (typeof defaultProvider === "string" && removedIds.has(defaultProvider)) {
    delete next.defaultProvider
    delete next.defaultModel
  }

  if (Array.isArray(next.enabledModels)) {
    const filtered = next.enabledModels.filter((pattern) => {
      if (typeof pattern !== "string") return false
      const normalized = stripThinkingLevel(pattern.trim())
      if (normalized === "/*") return true
      const providerPart = normalized.split("/")[0]
      if (!providerPart) return true
      return !removedIds.has(providerPart)
    })

    if (filtered.length === 0) {
      delete next.enabledModels
    } else if (filtered.length !== next.enabledModels.length) {
      next.enabledModels = filtered
    }
  }

  return next
}
