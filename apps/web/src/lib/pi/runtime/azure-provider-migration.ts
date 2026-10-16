/**
 * Pi 1.0.3 renamed the Azure provider from `azure-openai-responses` to
 * `azure`. Sessions and settings that still name the old id silently fall back
 * to another model, so rewrite saved Pi settings overrides on read and before
 * persisting. Idempotent: settings without the legacy id are returned as-is
 * (same object), and migrating twice yields the same result.
 */
export const LEGACY_AZURE_PROVIDER_ID = "azure-openai-responses"
export const AZURE_PROVIDER_ID = "azure"

const LEGACY_PREFIX = `${LEGACY_AZURE_PROVIDER_ID}/`

function renameModelKey(value: string) {
  if (value === LEGACY_AZURE_PROVIDER_ID) return AZURE_PROVIDER_ID
  if (value.startsWith(LEGACY_PREFIX)) {
    return `${AZURE_PROVIDER_ID}/${value.slice(LEGACY_PREFIX.length)}`
  }
  return value
}

/** Rename `azure-openai-responses` in a `provider/model` key or pattern. */
export function migrateLegacyAzureModelKey(value: string) {
  // enabledModels patterns may be negated or globbed (`!azure-openai-responses/*`).
  if (value.startsWith("!")) return `!${renameModelKey(value.slice(1))}`
  return renameModelKey(value)
}

export function migrateLegacyAzureProviderOverrides(
  overrides: Record<string, unknown>
): Record<string, unknown> {
  let changed = false
  const next: Record<string, unknown> = { ...overrides }

  if (next.defaultProvider === LEGACY_AZURE_PROVIDER_ID) {
    next.defaultProvider = AZURE_PROVIDER_ID
    changed = true
  }

  if (Array.isArray(next.enabledModels)) {
    const patterns = next.enabledModels.map((pattern: unknown) =>
      typeof pattern === "string"
        ? migrateLegacyAzureModelKey(pattern)
        : pattern
    )
    if (
      patterns.some(
        (pattern, index) =>
          pattern !== (next.enabledModels as Array<unknown>)[index]
      )
    ) {
      next.enabledModels = patterns
      changed = true
    }
  }

  const levels = next.modelThinkingLevels
  if (levels && typeof levels === "object" && !Array.isArray(levels)) {
    const entries = Object.entries(levels as Record<string, unknown>)
    if (entries.some(([key]) => migrateLegacyAzureModelKey(key) !== key)) {
      const migrated: Record<string, unknown> = {}
      for (const [key, value] of entries) {
        const nextKey = migrateLegacyAzureModelKey(key)
        // An explicit new-id entry wins over a migrated legacy one.
        if (nextKey !== key && Object.hasOwn(levels, nextKey)) continue
        migrated[nextKey] = value
      }
      next.modelThinkingLevels = migrated
      changed = true
    }
  }

  return changed ? next : overrides
}
