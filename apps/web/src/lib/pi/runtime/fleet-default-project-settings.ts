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
  // Deny-all by default: no models appear in the chat picker until the user
  // adds them via Settings > LLM Models. `undefined` (omitted) means allow-all.
  enabledModels: [],
}
