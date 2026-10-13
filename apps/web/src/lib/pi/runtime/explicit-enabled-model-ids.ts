import { stripThinkingLevel } from "@workspace/pi-protocol/model-patterns"
import {
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  isNamedOccInstanceId,
} from "@workspace/pi-protocol/provider-catalog"
import { isAllowAllEnabledModels } from "./project-settings-merge"

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
 * Model ids to register for one provider.
 *
 * `enabledModels: []` registers nothing. An allow-all list (missing or `/*`)
 * or a `provider/*` wildcard keeps the ids stored on the provider. A curated
 * list registers only the ids the user enabled. OpenAI Chat Completions,
 * including named instances, never grows past its configured ids.
 */
export function modelIdsForRegistration(
  stored: ReadonlyArray<string>,
  patterns: ReadonlyArray<string> | undefined,
  providerId: string,
  max = MAX_REGISTERED_PROVIDER_MODELS
): Array<string> {
  const storedIds = uniqueIds(stored, max)
  if (patterns !== undefined && patterns.length === 0) return []

  const enabled = explicitEnabledModelIds(patterns, providerId)
  if (
    isAllowAllEnabledModels(patterns) ||
    providerWildcardEnabled(patterns, providerId)
  ) {
    if (limitsRegistrationToStoredIds(providerId)) return storedIds
    return uniqueIds([...storedIds, ...enabled], max)
  }
  if (limitsRegistrationToStoredIds(providerId)) {
    const allowed = new Set(enabled)
    return storedIds.filter((id) => allowed.has(id))
  }
  return uniqueIds(enabled, max)
}

function providerWildcardEnabled(
  patterns: ReadonlyArray<string> | undefined,
  providerId: string
) {
  if (!patterns) return false
  const wildcard = `${providerId}/*`
  return patterns.some(
    (pattern) => stripThinkingLevel(pattern.trim()) === wildcard
  )
}

function limitsRegistrationToStoredIds(providerId: string) {
  return (
    providerId === OPENAI_CHAT_COMPLETIONS_PROVIDER_ID ||
    isNamedOccInstanceId(providerId)
  )
}

function uniqueIds(ids: ReadonlyArray<string>, max: number) {
  const seen = new Set<string>()
  const unique: Array<string> = []
  for (const raw of ids) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    unique.push(id)
    if (unique.length >= max) break
  }
  return unique
}
