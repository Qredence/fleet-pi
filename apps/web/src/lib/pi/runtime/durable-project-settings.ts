import { applyProjectSettingsToServices } from "./apply-project-settings"
import { FLEET_PI_BASE_PROJECT_SETTINGS } from "./fleet-default-project-settings"
import { mergeProjectSettingsRecords } from "./project-settings-merge"
import { readProjectSettingsFile } from "./project-settings-file"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import { loadUserProjectSettings } from "@/lib/db/user-settings"

export type ResolveProjectSettingsOptions = {
  userId?: string
  projectRoot?: string
}

export async function loadPersistedProjectSettingsOverrides(
  options: ResolveProjectSettingsOptions = {}
) {
  if (process.env.VERCEL === "1") {
    const stored = await loadUserProjectSettings(options.userId)
    return stored ? sanitizePortableResourcePaths(stored) : {}
  }

  if (!options.projectRoot) return {}
  return sanitizePortableResourcePaths(
    await readProjectSettingsFile(options.projectRoot)
  )
}

export async function resolveProjectSettings(
  options: ResolveProjectSettingsOptions = {}
) {
  const overrides = await loadPersistedProjectSettingsOverrides(options)
  return mergeProjectSettingsRecords(FLEET_PI_BASE_PROJECT_SETTINGS, overrides)
}

/** Drop absolute machine paths that cannot work on Vercel. */
export function sanitizePortableResourcePaths(
  settings: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...settings }
  for (const key of ["skills", "prompts", "extensions", "themes"] as const) {
    const value = next[key]
    if (!Array.isArray(value)) continue
    next[key] = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && isPortableSettingsResourcePath(item))
  }
  return next
}

export function isPortableSettingsResourcePath(path: string) {
  const normalized = path.replace(/\\/g, "/")
  if (normalized.startsWith("npm:")) return true
  if (normalized.startsWith("git:")) return true
  if (/^\/Users\//.test(normalized) || /^\/home\//.test(normalized)) {
    return false
  }
  if (/^[A-Za-z]:\//.test(normalized)) return false
  return true
}

/**
 * Apply merged Fleet base + overrides onto a live session.
 */
export async function hydrateSessionServicesSettings(
  services: AgentSessionServices,
  options: ResolveProjectSettingsOptions = {}
) {
  const settings = await resolveProjectSettings(options)
  applyProjectSettingsToServices(services, settings)
  await services.resourceLoader.reload()
}
