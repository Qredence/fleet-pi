import { beforeEach, describe, expect, it, vi } from "vitest"

import { removeProviderBundle } from "../remove-provider-bundle"

const mocks = vi.hoisted(() => ({
  removeProviderCredentialsAndSettings: vi.fn(),
  removeEnvVars: vi.fn(),
  loadPersistedProjectSettingsOverrides: vi.fn(),
  saveProjectSettingsOverrides: vi.fn(),
  prepareProjectSettingsForPersist: vi.fn(
    (overrides: Record<string, unknown>) => overrides
  ),
}))

vi.mock("@/lib/db/remove-provider-with-settings", () => ({
  removeProviderCredentialsAndSettings:
    mocks.removeProviderCredentialsAndSettings,
}))

vi.mock("@/lib/env-manager", () => ({
  removeEnvVars: mocks.removeEnvVars,
}))

vi.mock("../project-settings-persist", () => ({
  prepareProjectSettingsForPersist: mocks.prepareProjectSettingsForPersist,
  projectSettingsOverridesEqual: (
    left: Record<string, unknown>,
    right: Record<string, unknown>
  ) => JSON.stringify(left) === JSON.stringify(right),
}))

vi.mock("../durable-project-settings", () => ({
  loadPersistedProjectSettingsOverrides:
    mocks.loadPersistedProjectSettingsOverrides,
}))

vi.mock("../settings-bridge", () => ({
  saveProjectSettingsOverrides: mocks.saveProjectSettingsOverrides,
}))

vi.mock("../cleanup-project-settings-for-removed-provider", () => ({
  cleanupProjectSettingsForRemovedProvider: vi.fn(() => ({
    enabledModels: ["openai-chat-completions/model-a"],
  })),
}))

describe("removeProviderBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mocks.loadPersistedProjectSettingsOverrides.mockResolvedValue({
      defaultProvider: "google",
      enabledModels: ["google/*"],
    })
  })

  it("removes credentials and settings atomically on Vercel when settings change", async () => {
    vi.stubEnv("VERCEL", "1")

    await removeProviderBundle({
      context: { projectRoot: "/repo" } as never,
      providerId: "google",
      userId: "user-1",
    })

    expect(mocks.removeProviderCredentialsAndSettings).toHaveBeenCalledWith(
      "user-1",
      ["google"],
      { enabledModels: ["openai-chat-completions/model-a"] }
    )
    expect(mocks.removeEnvVars).not.toHaveBeenCalled()
    expect(mocks.saveProjectSettingsOverrides).not.toHaveBeenCalled()
  })

  it("removes local env vars and persists cleaned settings separately", async () => {
    await removeProviderBundle({
      context: { projectRoot: "/repo" } as never,
      providerId: "google",
    })

    expect(mocks.removeEnvVars).toHaveBeenCalledWith("/repo", [
      "GEMINI_API_KEY",
    ])
    expect(mocks.saveProjectSettingsOverrides).toHaveBeenCalledWith(
      { projectRoot: "/repo" },
      { enabledModels: ["openai-chat-completions/model-a"] },
      { userId: undefined }
    )
    expect(mocks.removeProviderCredentialsAndSettings).not.toHaveBeenCalled()
  })
})
