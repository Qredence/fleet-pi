import { FLEET_PI_BASE_PROJECT_SETTINGS } from "./fleet-default-project-settings"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** True when `enabledModels` is absent or equivalent to allow-all. */
export function isAllowAllEnabledModels(value: unknown) {
  if (value === undefined) return true
  if (!Array.isArray(value)) return false
  if (value.length === 0) return false
  return value.some(
    (pattern) => typeof pattern === "string" && pattern.trim() === "/*"
  )
}

/** Paths Pi auto-discovers under `.pi/` — omit from persisted overrides. */
function isAutoDiscoveredResourcePath(path: string, key: string) {
  const normalized = path.replace(/\\/g, "/").trim()
  if (normalized.startsWith("../agent-workspace/")) return false
  if (key === "extensions" && normalized.startsWith("extensions/")) {
    return true
  }
  if (
    key === "skills" &&
    (normalized === "skills" || normalized.startsWith("skills/"))
  ) {
    return true
  }
  if (key === "prompts" && normalized.startsWith("prompts/")) {
    return true
  }
  if (key === "themes" && normalized.startsWith("themes/")) {
    return true
  }
  return false
}

function normalizePersistedResourcePaths(
  value: unknown,
  key: string
): Array<string> | undefined {
  if (!Array.isArray(value)) return undefined
  const filtered = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => !isAutoDiscoveredResourcePath(item, key))
  return filtered
}

/**
 * Merge Fleet base settings with user/workspace overrides. Override keys win.
 */
export function mergeProjectSettingsRecords(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>
) {
  const next = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue
    next[key] = value
  }
  return next
}

/**
 * Persist only values that differ from Fleet base. Strips allow-all
 * `enabledModels`, empty arrays, and Pi auto-discovered resource paths.
 */
export function compactProjectSettingsForPersist(
  merged: Record<string, unknown>,
  base: Record<string, unknown> = FLEET_PI_BASE_PROJECT_SETTINGS
) {
  const result: Record<string, unknown> = {}

  for (const [key, rawValue] of Object.entries(merged)) {
    if (key === "enabledModels") {
      if (isAllowAllEnabledModels(rawValue)) continue
      if (valuesEqual(rawValue, base[key])) continue
      result[key] = rawValue
      continue
    }

    if (
      key === "skills" ||
      key === "extensions" ||
      key === "prompts" ||
      key === "themes"
    ) {
      const normalized = normalizePersistedResourcePaths(rawValue, key)
      if (!normalized || normalized.length === 0) continue
      const baseNormalized =
        normalizePersistedResourcePaths(base[key], key) ?? []
      if (valuesEqual(normalized, baseNormalized)) continue
      result[key] = normalized
      continue
    }

    if (Array.isArray(rawValue) && rawValue.length === 0) continue
    if (isRecord(rawValue) && Object.keys(rawValue).length === 0) continue
    if (valuesEqual(rawValue, base[key])) continue
    result[key] = rawValue
  }

  return result
}
