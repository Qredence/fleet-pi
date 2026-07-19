import {
  hasGlobCharacters,
  isModelPatternEnabled,
  modelMatchesPattern,
  modelPattern,
  stripThinkingLevel,
} from "../../../../../lib/pi/model-patterns"
import type { ConfigModelInfo } from "./types"

export function customModelKey(provider: string, model: string) {
  return `${provider}/${model}`
}

export function isModelEnabled(
  model: ConfigModelInfo,
  patterns: Array<string> | undefined
) {
  return isModelPatternEnabled(
    {
      id: model.id,
      name: model.name,
      provider: model.provider,
      modelId: model.modelId,
    },
    patterns
  )
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

  // Only collapse to allow-all when enabling every catalog model — not after
  // removals, or a curated deny-list would snap back to allow-all on reopen.
  if (
    enabled &&
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

export {
  modelMatchesPattern,
  modelPattern,
  stripThinkingLevel,
  hasGlobCharacters,
}

export function modelPatternFor(model: ConfigModelInfo) {
  return modelPattern(model.provider, model.modelId)
}

function addUnique(values: Array<string>, value: string) {
  return values.includes(value) ? values : [...values, value]
}
