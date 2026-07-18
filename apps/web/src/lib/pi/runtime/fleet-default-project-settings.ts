/**
 * Fleet Pi base project settings (code defaults). `.pi/settings.json` and Neon
 * `pi_user_settings` store overrides only; runtime merges base + overrides.
 */
export const FLEET_PI_BASE_PROJECT_SETTINGS: Record<string, unknown> = {
  packages: [
    "npm:pi-autoresearch",
    "npm:pi-skill-palette",
    "npm:pi-autocontext",
    "npm:pi-web-access",
  ],
  skills: ["../agent-workspace/pi/skills"],
  prompts: ["../agent-workspace/pi/prompts"],
  extensions: ["../agent-workspace/pi/extensions/enabled"],
  defaultProvider: "google",
  defaultModel: "gemini-3.5-flash",
  defaultThinkingLevel: "high",
  enableSkillCommands: true,
  // Omit enabledModels for allow-all discovery. Users persist overrides when
  // curating models in Settings; an empty array means deny-all.
}

/** @deprecated Use FLEET_PI_BASE_PROJECT_SETTINGS */
export const VERCEL_DEFAULT_PROJECT_SETTINGS = FLEET_PI_BASE_PROJECT_SETTINGS
