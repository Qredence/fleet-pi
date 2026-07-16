import type { ChatThinkingLevel } from "./chat-protocol"

const THINKING_LEVELS = new Set<ChatThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
])

export type ModelPatternCandidate = {
  id: string
  name?: string
  key?: string
  provider?: string
  modelId?: string
}

export function isModelPatternEnabled(
  model: ModelPatternCandidate,
  patterns: Array<string> | undefined
) {
  if (patterns === undefined) return true
  if (patterns.length === 0) return false
  return patterns.some((pattern) => modelMatchesPattern(model, pattern))
}

export function modelMatchesPattern(
  model: ModelPatternCandidate,
  pattern: string
) {
  const normalizedPattern = stripThinkingLevel(pattern.trim()).toLowerCase()
  const candidates = [
    model.id,
    model.modelId,
    model.name,
    model.key,
    model.provider && model.modelId
      ? `${model.provider}/${model.modelId}`
      : undefined,
    model.provider && model.id ? `${model.provider}/${model.id}` : undefined,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase())

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

export function stripThinkingLevel(pattern: string) {
  const separatorIndex = pattern.lastIndexOf(":")
  if (separatorIndex === -1) return pattern
  const suffix = pattern.slice(separatorIndex + 1)
  return THINKING_LEVELS.has(suffix as ChatThinkingLevel)
    ? pattern.slice(0, separatorIndex)
    : pattern
}

export function hasGlobCharacters(pattern: string) {
  return pattern.includes("*") || pattern.includes("?")
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function modelPattern(provider: string, modelId: string) {
  return `${provider}/${modelId}`
}
