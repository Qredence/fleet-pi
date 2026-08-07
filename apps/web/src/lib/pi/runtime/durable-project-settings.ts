import { writeFile } from "node:fs/promises"
import { applyProjectSettingsToServices } from "./apply-project-settings"
import { getFleetBaseProjectSettings } from "./fleet-default-project-settings"
import { migrateLegacyGatewayProjectOverrides } from "./gateway-settings-migration"
import { serializeProjectSettingsPreservingFormat } from "./project-settings-format"
import { mergeProjectSettingsRecords } from "./project-settings-merge"
import {
  projectSettingsPath,
  readProjectSettingsFile,
  readRawProjectSettingsFile,
} from "./project-settings-file"
import { usesDatabaseBackedProjectSettings } from "./deployed-chat-runtime"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import { loadUserProjectSettings } from "@/lib/db/user-settings"

export type ResolveProjectSettingsOptions = {
  userId?: string
  projectRoot?: string
}

export async function loadPersistedProjectSettingsOverrides(
  options: ResolveProjectSettingsOptions = {}
) {
  if (usesDatabaseBackedProjectSettings()) {
    const stored = await loadUserProjectSettings(options.userId)
    const overrides = stored ? sanitizePortableResourcePaths(stored) : {}
    return migrateLegacyGatewayProjectOverrides(overrides, options.userId)
  }

  if (!options.projectRoot) return {}
  const overrides = sanitizePortableResourcePaths(
    await readProjectSettingsFile(options.projectRoot)
  )
  return migrateLegacyGatewayProjectOverrides(overrides, options.userId)
}

export async function resolveProjectSettings(
  options: ResolveProjectSettingsOptions = {}
) {
  const overrides = await loadPersistedProjectSettingsOverrides(options)
  return mergeProjectSettingsRecords(getFleetBaseProjectSettings(), overrides)
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
  const rawBefore = options.projectRoot
    ? await readRawProjectSettingsFile(options.projectRoot)
    : undefined
  const settings = await resolveProjectSettings(options)
  applyProjectSettingsToServices(services, settings)
  await restoreProjectSettingsFileFormatting(
    services.settingsManager,
    options.projectRoot,
    rawBefore
  )
  await services.resourceLoader.reload()
}

/**
 * Pi's project settings writer re-serializes the whole file with normalized
 * formatting (wrapped arrays, no trailing newline). When hydration genuinely
 * changed the file's semantics, rewrite it once more — spliced onto the
 * original formatting — so tracked `.pi/settings.json` files keep their
 * style. No-op (or file-not-changed) cases produce no write at all.
 */
export async function restoreProjectSettingsFileFormatting(
  settingsManager: AgentSessionServices["settingsManager"],
  projectRoot: string | undefined,
  rawBefore: string | undefined
) {
  if (!projectRoot || rawBefore === undefined) return
  try {
    const flusher = settingsManager as unknown as {
      flush?: () => Promise<void>
    }
    await flusher.flush?.()
    const rawAfter = await readRawProjectSettingsFile(projectRoot)
    if (rawAfter === undefined || rawAfter === rawBefore) return
    const parsed = JSON.parse(rawAfter) as unknown
    if (!isRecord(parsed)) return
    const restored = serializeProjectSettingsPreservingFormat(rawBefore, parsed)
    if (restored !== rawAfter) {
      await writeFile(projectSettingsPath(projectRoot), restored, "utf8")
    }
  } catch {
    // Best effort: Pi project writes can already fail on read-only deployed
    // filesystems; formatting restoration must never break hydration.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
