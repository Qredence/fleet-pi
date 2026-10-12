import { stripThinkingLevel } from "@workspace/pi-protocol/model-patterns"

/** Upper bound on models registered for one provider after a user enables them. */
export const MAX_REGISTERED_PROVIDER_MODELS = 256

/**
 * Model ids the user explicitly enabled for one provider.
 * Globs are ignored so `provider/*` does not register a wildcard id.
 * Ids may contain slashes (`deepseek/deepseek-v4-flash`).
 */
export function explicitEnabledModelIds(
  patterns: ReadonlyArray<string> | undefined,
  providerId: string
): Array<string> {
  if (!patterns || patterns.length === 0) return []
  const prefix = `${providerId}/`
  const ids: Array<string> = []
  const seen = new Set<string>()
  for (const pattern of patterns) {
    const normalized = stripThinkingLevel(pattern.trim())
    if (!normalized.startsWith(prefix)) continue
    const modelId = normalized.slice(prefix.length).trim()
    if (!modelId || modelId.includes("*") || modelId.includes("?")) continue
    if (seen.has(modelId)) continue
    seen.add(modelId)
    ids.push(modelId)
  }
  return ids
}

/**
 * Stored provider models plus ids the user later enabled in Settings.
 * Stored ids stay first. The result is capped.
 */
export function modelIdsForRegistration(
  stored: ReadonlyArray<string>,
  patterns: ReadonlyArray<string> | undefined,
  providerId: string,
  max = MAX_REGISTERED_PROVIDER_MODELS
): Array<string> {
  const seen = new Set<string>()
  const merged: Array<string> = []
  for (const raw of [
    ...stored,
    ...explicitEnabledModelIds(patterns, providerId),
  ]) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    merged.push(id)
    if (merged.length >= max) break
  }
  return merged
}
