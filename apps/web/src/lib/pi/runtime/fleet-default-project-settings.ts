import { getChatAuthSurface } from "@/lib/auth/chat-auth-surface"

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
