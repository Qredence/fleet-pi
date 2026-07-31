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
 * @returns A shallow copy of the shared Fleet Pi project settings
 */
export function getFleetBaseProjectSettings(): Record<string, unknown> {
  return { ...FLEET_PI_SHARED_PROJECT_SETTINGS }
}
