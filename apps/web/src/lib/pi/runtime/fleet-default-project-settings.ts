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
  defaultProvider: "openai-chat-completions",
  defaultModel: "qwen35-122b-a10b",
  defaultThinkingLevel: "high",
  enableSkillCommands: true,
  // Curated Neon AI Gateway models for authenticated deploys; local BYOK/OCC
  // overrides still apply. `undefined` (omitted) means allow-all.
  enabledModels: [
    "openai-chat-completions/qwen35-122b-a10b",
    "openai-chat-completions/gpt-oss-120b",
  ],
}
