import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  NEON_AI_GATEWAY_DEFAULT_MODEL,
  NEON_AI_GATEWAY_DEFAULT_MODEL_IDS,
  captureAndScrubNeonAiGatewayEnv,
  resetCapturedNeonAiGatewayCredentialsForTests,
  resolveNeonAiGatewayConfig,
} from "../neon-ai-gateway"

describe("neon-ai-gateway", () => {
  const originalToken = process.env.NEON_AI_GATEWAY_TOKEN
  const originalBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL

  beforeEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_test_token"
    process.env.NEON_AI_GATEWAY_BASE_URL =
      "https://branch-id-api.ai.aws-us-east-2.aws.neon.tech"
  })

  afterEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = originalToken
    process.env.NEON_AI_GATEWAY_BASE_URL = originalBaseUrl
  })

  it("returns undefined without a user id", () => {
    expect(resolveNeonAiGatewayConfig(undefined)).toBeUndefined()
  })

  it("returns gateway config for authenticated users when env is set", () => {
    const config = resolveNeonAiGatewayConfig("user-1")
    expect(config).toEqual({
      apiKey: "nt_live_test_token",
      baseUrl: "https://branch-id-api.ai.aws-us-east-2.aws.neon.tech/v1",
      modelIds: [...NEON_AI_GATEWAY_DEFAULT_MODEL_IDS],
    })
    expect(NEON_AI_GATEWAY_DEFAULT_MODEL).toBe("qwen35-122b-a10b")
  })

  it("returns undefined when gateway env is missing", () => {
    delete process.env.NEON_AI_GATEWAY_TOKEN
    expect(resolveNeonAiGatewayConfig("user-1")).toBeUndefined()
  })

  it("keeps gateway config after captureAndScrub removes env", () => {
    captureAndScrubNeonAiGatewayEnv()
    expect(process.env.NEON_AI_GATEWAY_TOKEN).toBeUndefined()
    expect(process.env.NEON_AI_GATEWAY_BASE_URL).toBeUndefined()
    expect(resolveNeonAiGatewayConfig("user-1")).toEqual({
      apiKey: "nt_live_test_token",
      baseUrl: "https://branch-id-api.ai.aws-us-east-2.aws.neon.tech/v1",
      modelIds: [...NEON_AI_GATEWAY_DEFAULT_MODEL_IDS],
    })
  })
})
