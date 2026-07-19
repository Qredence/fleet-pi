import { vi } from "vitest"

export function createMockSettingsManager() {
  return {
    drainErrors: vi.fn(() => []),
    reload: vi.fn(async () => undefined),
    setProjectPackages: vi.fn(),
    setProjectSkillPaths: vi.fn(),
    setProjectExtensionPaths: vi.fn(),
    setProjectPromptTemplatePaths: vi.fn(),
    setProjectThemePaths: vi.fn(),
    setEnableSkillCommands: vi.fn(),
    setEnabledModels: vi.fn(),
    setDefaultProvider: vi.fn(),
    setDefaultModel: vi.fn(),
    setDefaultThinkingLevel: vi.fn(),
    setSteeringMode: vi.fn(),
    setFollowUpMode: vi.fn(),
    applyOverrides: vi.fn(),
    getDefaultProvider: vi.fn(() => "google"),
    getDefaultModel: vi.fn(() => "gemini-3.5-flash"),
    getDefaultThinkingLevel: vi.fn(() => "medium"),
    getEnabledModels: vi.fn(() => undefined),
    getEnableSkillCommands: vi.fn(() => true),
    getCompaction: vi.fn(() => ({
      enabled: false,
      reserveTokens: 0,
      keepRecentTokens: 0,
    })),
    getRetry: vi.fn(() => ({
      enabled: false,
      maxRetries: 0,
      baseDelayMs: 0,
    })),
    getTransport: vi.fn(() => "auto" as const),
    getSteeringMode: vi.fn(() => "one-at-a-time" as const),
    getFollowUpMode: vi.fn(() => "one-at-a-time" as const),
    getExtensionPaths: vi.fn(() => []),
    getSkillPaths: vi.fn(() => []),
    getPromptTemplatePaths: vi.fn(() => []),
    getThemePaths: vi.fn(() => []),
    getPackages: vi.fn(() => []),
  }
}
