import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { migrateLegacyGatewayProjectOverrides } from "../gateway-settings-migration"
import { resetCapturedNeonAiGatewayCredentialsForTests } from "../neon-ai-gateway"
import { TEST_NEON_AI_GATEWAY_BASE_URL } from "./gateway-test-fixtures"

vi.mock("../user-provider-secrets", () => ({
  hasExplicitOccByok: vi.fn(async () => false),
}))

describe("migrateLegacyGatewayProjectOverrides", () => {
  const originalToken = process.env.NEON_AI_GATEWAY_TOKEN
  const originalBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL

  beforeEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_gateway"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL
  })

  afterEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = originalToken
    process.env.NEON_AI_GATEWAY_BASE_URL = originalBaseUrl
  })

  it("drops legacy enabledModels and defaultModel when gateway is active", async () => {
    const migrated = await migrateLegacyGatewayProjectOverrides(
      {
        defaultProvider: "openai-chat-completions",
        defaultModel: "deepseek-v4-flash-free",
        enabledModels: ["openai-chat-completions/deepseek-v4-flash-free"],
      },
      "user-1"
    )

    expect(migrated).toEqual({})
  })

  it("strips legacy patterns from mixed enabledModels", async () => {
    const migrated = await migrateLegacyGatewayProjectOverrides(
      {
        enabledModels: [
          "openai-chat-completions/deepseek-v4-flash-free",
          "google/gemini-2.5-flash",
        ],
      },
      "user-1"
    )

    expect(migrated).toEqual({
      enabledModels: ["google/gemini-2.5-flash"],
    })
  })

  it("keeps non-legacy overrides when gateway is active", async () => {
    const overrides = {
      defaultProvider: "google",
      defaultModel: "gemini-2.5-flash",
      enabledModels: ["google/gemini-2.5-flash"],
    }

    expect(
      await migrateLegacyGatewayProjectOverrides(overrides, "user-1")
    ).toEqual(overrides)
  })

  it("no-ops without gateway env", async () => {
    delete process.env.NEON_AI_GATEWAY_TOKEN
    const overrides = {
      enabledModels: ["openai-chat-completions/deepseek-v4-flash-free"],
    }

    expect(
      await migrateLegacyGatewayProjectOverrides(overrides, "user-1")
    ).toEqual(overrides)
  })

  it("keeps legacy overrides for users with explicit OCC BYOK", async () => {
    const { hasExplicitOccByok } = await import("../user-provider-secrets")
    vi.mocked(hasExplicitOccByok).mockResolvedValue(true)
    try {
      const overrides = {
        defaultProvider: "openai-chat-completions",
        defaultModel: "deepseek-v4-flash-free",
        enabledModels: ["openai-chat-completions/deepseek-v4-flash-free"],
      }

      // The user deliberately configured this provider in Settings: the
      // migration must not retire their explicit model configuration.
      expect(
        await migrateLegacyGatewayProjectOverrides(overrides, "user-1")
      ).toEqual(overrides)
    } finally {
      vi.mocked(hasExplicitOccByok).mockResolvedValue(false)
    }
  })
})
