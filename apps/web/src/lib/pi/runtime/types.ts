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

export type ApplyRuntimeAuthOptions = {
  userId?: string
}
