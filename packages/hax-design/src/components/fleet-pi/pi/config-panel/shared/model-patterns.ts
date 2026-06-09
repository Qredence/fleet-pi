import { THINKING_LEVELS } from "./constants"
import type { ChatThinkingLevel } from "../../../../../lib/pi/chat-protocol"
import type { ConfigModelInfo } from "./types"

export function customModelKey(provider: string, model: string) {
  return `${provider}/${model}`
}

export function isModelEnabled(
  model: ConfigModelInfo,
  patterns: Array<string> | undefined
) {
  if (patterns === undefined) return true
  if (patterns.length === 0) return false
  return patterns.some((pattern) => modelMatchesPattern(model, pattern))
}

export function nextEnabledModelPatterns({
  currentPatterns,
  enabled,
  model,
  models,
}: {
  currentPatterns: Array<string> | undefined
  enabled: boolean
  model: ConfigModelInfo
  models: Array<ConfigModelInfo>
}) {
  if (currentPatterns === undefined && enabled) return undefined

  const current = currentPatterns ?? []
  const knownModelPatterns = new Set(
    models.map((item) => modelPatternFor(item))
  )
  const activeKnown = new Set(
    models
      .filter((item) => isModelEnabled(item, currentPatterns))
      .map((item) => modelPatternFor(item))
  )

  if (enabled) {
    activeKnown.add(modelPatternFor(model))
  } else {
    activeKnown.delete(modelPatternFor(model))
  }

  const preservedPatterns = current.filter((pattern) => {
    if (knownModelPatterns.has(pattern)) return false
    return enabled || !modelMatchesPattern(model, pattern)
  })
  const next = [...preservedPatterns, ...activeKnown]

  if (
    preservedPatterns.length === 0 &&
    models.every((item) => activeKnown.has(modelPatternFor(item)))
  ) {
    return undefined
  }

  return next
}

export function nextProviderModelPatterns({
  currentPatterns,
  enabled,
  models,
  provider,
}: {
  currentPatterns: Array<string> | undefined
  enabled: boolean
  models: Array<ConfigModelInfo>
  provider: string
}) {
  if (currentPatterns === undefined && enabled) return undefined

  const providerModels = models.filter((model) => model.provider === provider)
  const providerPattern = `${provider}/*`
  if (enabled) {
    return addUnique(
      withoutProviderPatterns(currentPatterns ?? [], providerModels, provider),
      providerPattern
    )
  }

  const remainingActive = models
    .filter(
      (model) =>
        model.provider !== provider && isModelEnabled(model, currentPatterns)
    )
    .map((model) => modelPatternFor(model))
  const preserved = withoutProviderPatterns(
    currentPatterns ?? [],
    providerModels,
    provider
  )
  return [...preserved, ...remainingActive]
}

export function withoutProviderPatterns(
  patterns: Array<string>,
  providerModels: Array<ConfigModelInfo>,
  provider: string
) {
  return patterns.filter((pattern) => {
    if (pattern === `${provider}/*`) return false
    return !providerModels.some((model) => modelMatchesPattern(model, pattern))
  })
}

export function ensureModelEnabled(
  patterns: Array<string> | undefined,
  model: ConfigModelInfo
) {
  if (patterns === undefined) return undefined
  if (patterns.some((pattern) => modelMatchesPattern(model, pattern))) {
    return patterns
  }
  return addUnique(patterns, modelPatternFor(model))
}

export function ensureModelPattern(
  patterns: Array<string> | undefined,
  provider: string,
  modelId: string
) {
  if (patterns === undefined) return undefined
  return addUnique(patterns, modelPattern(provider, modelId))
}

export function modelMatchesPattern(model: ConfigModelInfo, pattern: string) {
  const normalizedPattern = stripThinkingLevel(pattern.trim()).toLowerCase()
  const candidates = [
    model.id,
    model.modelId,
    model.name,
    modelPatternFor(model),
  ].map((value) => value.toLowerCase())

  if (!hasGlobCharacters(normalizedPattern)) {
    return candidates.includes(normalizedPattern)
  }

  const matcher = new RegExp(
    `^${normalizedPattern
      .split("")
      .map((character) =>
        character === "*"
          ? ".*"
          : character === "?"
            ? "."
            : escapeRegExp(character)
      )
      .join("")}$`
  )
  return candidates.some((candidate) => matcher.test(candidate))
}

export function modelPatternFor(model: ConfigModelInfo) {
  return modelPattern(model.provider, model.modelId)
}

export function modelPattern(provider: string, modelId: string) {
  return `${provider}/${modelId}`
}

export function stripThinkingLevel(pattern: string) {
  const separatorIndex = pattern.lastIndexOf(":")
  if (separatorIndex === -1) return pattern
  const suffix = pattern.slice(separatorIndex + 1)
  return THINKING_LEVELS.includes(suffix as ChatThinkingLevel)
    ? pattern.slice(0, separatorIndex)
    : pattern
}

export function hasGlobCharacters(pattern: string) {
  return pattern.includes("*") || pattern.includes("?")
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function addUnique(values: Array<string>, value: string) {
  return values.includes(value) ? values : [...values, value]
}
