import type { ChatThinkingLevel } from "@workspace/hax-design/lib/pi/chat-protocol"

export const DEFAULT_MODEL = "gemini-3.5-flash"

export const RESOURCE_SETTING_KEYS = [
  "packages",
  "extensions",
  "skills",
  "prompts",
  "themes",
  "enableSkillCommands",
] as const

export type PiRuntimeAuthConfig = {
  gateway?: { apiKey?: string }
  customEnv?: Record<string, string>
  runtimeApiKeys?: Record<string, string>
}

export type PiRuntimeConfig = {
  model?: { provider: string; id: string }
  thinkingLevel?: ChatThinkingLevel
  auth?: PiRuntimeAuthConfig
}

export type ApplyRuntimeAuthOptions = {
  userId?: string
}
