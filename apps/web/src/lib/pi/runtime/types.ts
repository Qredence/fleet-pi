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
