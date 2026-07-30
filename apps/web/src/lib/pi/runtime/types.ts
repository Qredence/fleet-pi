import { OPENAI_CHAT_COMPLETIONS_PROVIDER_ID } from "@workspace/pi-protocol/provider-catalog"
import { NEON_AI_GATEWAY_DEFAULT_MODEL } from "./neon-ai-gateway"

/** Deployed-authenticated default model (Neon AI Gateway OCC). */
export const DEFAULT_MODEL = NEON_AI_GATEWAY_DEFAULT_MODEL

export const DEFAULT_PROVIDER = OPENAI_CHAT_COMPLETIONS_PROVIDER_ID

export const RESOURCE_SETTING_KEYS = [
  "packages",
  "extensions",
  "skills",
  "prompts",
  "themes",
  "enableSkillCommands",
] as const

export type ApplyRuntimeAuthOptions = {
  userId?: string
}
