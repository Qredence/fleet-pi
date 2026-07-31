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
 * Fleet Pi base project settings (code defaults). `.pi/settings.json` and Neon
 * `pi_user_settings` store overrides only; runtime merges base + overrides.
 *
 * No `defaultProvider`/`defaultModel`/`enabledModels` are baked in: the user
 * chooses the provider and LLM model in Settings. Local and deployed surfaces
 * share the same provider-agnostic base until the user configures one.
 */
export function getFleetBaseProjectSettings(): Record<string, unknown> {
  return { ...FLEET_PI_SHARED_PROJECT_SETTINGS }
}
