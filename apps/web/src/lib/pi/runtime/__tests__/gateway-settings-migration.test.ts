import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { migrateLegacyGatewayProjectOverrides } from "../gateway-settings-migration"
import { resetCapturedNeonAiGatewayCredentialsForTests } from "../neon-ai-gateway"

describe("migrateLegacyGatewayProjectOverrides", () => {
  const originalToken = process.env.NEON_AI_GATEWAY_TOKEN
  const originalBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL

  beforeEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_gateway"
    process.env.NEON_AI_GATEWAY_BASE_URL =
      "https://branch-id-api.ai.aws-us-east-2.aws.neon.tech"
  })

  afterEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = originalToken
    process.env.NEON_AI_GATEWAY_BASE_URL = originalBaseUrl
  })

  it("drops legacy enabledModels and defaultModel when gateway is active", () => {
    const migrated = migrateLegacyGatewayProjectOverrides(
      {
        defaultProvider: "openai-chat-completions",
        defaultModel: "deepseek-v4-flash-free",
        enabledModels: ["openai-chat-completions/deepseek-v4-flash-free"],
      },
      "user-1"
    )

    expect(migrated).toEqual({})
  })

  it("strips legacy patterns from mixed enabledModels", () => {
    const migrated = migrateLegacyGatewayProjectOverrides(
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

  it("keeps non-legacy overrides when gateway is active", () => {
    const overrides = {
      defaultProvider: "google",
      defaultModel: "gemini-2.5-flash",
      enabledModels: ["google/gemini-2.5-flash"],
    }

    expect(migrateLegacyGatewayProjectOverrides(overrides, "user-1")).toEqual(
      overrides
    )
  })

  it("no-ops without gateway env", () => {
    delete process.env.NEON_AI_GATEWAY_TOKEN
    const overrides = {
      enabledModels: ["openai-chat-completions/deepseek-v4-flash-free"],
    }

    expect(migrateLegacyGatewayProjectOverrides(overrides, "user-1")).toEqual(
      overrides
    )
  })
})
