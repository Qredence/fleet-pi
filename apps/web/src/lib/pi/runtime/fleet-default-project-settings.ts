import type { SettingsManager } from "@earendil-works/pi-coding-agent"
import { getChatAuthSurface } from "@/lib/auth/chat-auth-surface"
import { isHostedDeployment } from "@/lib/deployment/environment"

export const FLEET_PI_SHARED_PROJECT_SETTINGS = {
  packages: [
    "npm:pi-autoresearch",
    "npm:pi-skill-palette",
    "npm:pi-autocontext",
    "npm:pi-web-access",
  ],
  skills: ["../agent-workspace/pi/skills"],
  prompts: ["../agent-workspace/pi/prompts"],
  extensions: ["../agent-workspace/pi/extensions/enabled"],
  defaultThinkingLevel: "high",
  enableSkillCommands: true,
} as const

/**
 * Provides the provider-agnostic Fleet Pi project settings used as code defaults.
 *
 * Runtime settings merge these defaults with overrides from `.pi/settings.json` and
 * Neon `pi_user_settings`.
 *
 * On the Neon Function runtime the base `npm:` packages are omitted: the sandbox
 * has no `npm` binary and no persistent package cache, so Pi would `spawn npm
 * install` and fail session creation with `ENOENT`. Local `../agent-workspace/...`
 * resource paths are kept — the loader skips missing local dirs, and per-user
 * overrides still merge on top when present.
 *
 * @returns A shallow copy of the surface-appropriate Fleet Pi project settings
 */
export function getFleetBaseProjectSettings(): Record<string, unknown> {
  const settings: Record<string, unknown> = {
    ...FLEET_PI_SHARED_PROJECT_SETTINGS,
  }
  if (getChatAuthSurface() === "neon-function") {
    settings.packages = []
  }
  return settings
}

/**
 * Cloudflare Workers and the Neon Function cannot spawn `npm` or `git`.
 * Pi's resource loader installs missing `npm:` and `git:` packages during
 * session startup, and that spawn fails the whole settings, model, and chat
 * request. The settings document still lists those packages; only the loader
 * view drops them. Local paths stay so a private resource copy can load.
 */
export function hostedRuntimeSkipsPackageInstall() {
  return isHostedDeployment() || getChatAuthSurface() === "neon-function"
}

export function omitRemoteInstallPackages<T extends { packages?: unknown }>(
  settings: T
): T {
  if (!hostedRuntimeSkipsPackageInstall()) return settings
  const packages = settings.packages
  if (!Array.isArray(packages)) return settings
  const kept = packages.filter((entry) => {
    const source = readPackageSource(entry)
    return source !== undefined && !isRemoteInstallPackageSource(source)
  })
  if (kept.length === packages.length) return settings
  return { ...settings, packages: kept }
}

export function settingsManagerForLoader(
  manager: SettingsManager
): SettingsManager {
  if (!hostedRuntimeSkipsPackageInstall()) return manager
  return new Proxy(manager, {
    get(target, property, receiver) {
      if (property === "getProjectSettings") {
        return () => omitRemoteInstallPackages(target.getProjectSettings())
      }
      const value = Reflect.get(target, property, receiver)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

function readPackageSource(entry: unknown) {
  if (typeof entry === "string") return entry
  if (
    entry &&
    typeof entry === "object" &&
    "source" in entry &&
    typeof entry.source === "string"
  ) {
    return entry.source
  }
  return undefined
}

function isRemoteInstallPackageSource(source: string) {
  const normalized = source.trim()
  return (
    normalized.startsWith("npm:") ||
    normalized.startsWith("git:") ||
    normalized.startsWith("github:")
  )
}
