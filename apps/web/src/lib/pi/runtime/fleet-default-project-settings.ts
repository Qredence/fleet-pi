import { OPENAI_CHAT_COMPLETIONS_PROVIDER_ID } from "@workspace/pi-protocol/provider-catalog"
import { isDeployedChatRuntimeSurface } from "./deployed-chat-runtime"
import {
  NEON_AI_GATEWAY_DEFAULT_MODEL,
  NEON_AI_GATEWAY_DEFAULT_MODEL_IDS,
} from "./neon-ai-gateway"

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

const GATEWAY_ENABLED_MODELS = NEON_AI_GATEWAY_DEFAULT_MODEL_IDS.map(
  (modelId) => `${OPENAI_CHAT_COMPLETIONS_PROVIDER_ID}/${modelId}`
)

/** Deployed authenticated chat defaults (Neon AI Gateway OCC). */
export const FLEET_PI_DEPLOYED_PROJECT_SETTINGS: Record<string, unknown> = {
  ...FLEET_PI_SHARED_PROJECT_SETTINGS,
  defaultProvider: OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  defaultModel: NEON_AI_GATEWAY_DEFAULT_MODEL,
  enabledModels: [...GATEWAY_ENABLED_MODELS],
}

/**
 * Fleet Pi base project settings (code defaults). `.pi/settings.json` and Neon
 * `pi_user_settings` store overrides only; runtime merges base + overrides.
 *
 * Local anonymous dev omits Gateway-only model defaults so env/BYOK providers
 * (e.g. `GEMINI_API_KEY`) work out of the box.
 */
export function getFleetBaseProjectSettings(
  options: { deployed?: boolean } = {}
): Record<string, unknown> {
  const deployed = options.deployed ?? isDeployedChatRuntimeSurface()

  if (deployed) {
    return { ...FLEET_PI_DEPLOYED_PROJECT_SETTINGS }
  }

  return { ...FLEET_PI_SHARED_PROJECT_SETTINGS }
}
