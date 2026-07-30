import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  NEON_AI_GATEWAY_DEFAULT_MODEL,
  NEON_AI_GATEWAY_DEFAULT_MODEL_IDS,
  captureAndScrubNeonAiGatewayEnv,
  resetCapturedNeonAiGatewayCredentialsForTests,
  resolveNeonAiGatewayConfig,
} from "../neon-ai-gateway"
import {
  TEST_NEON_AI_GATEWAY_BASE_URL,
  TEST_NEON_AI_GATEWAY_BASE_URL_V1,
} from "./gateway-test-fixtures"

describe("neon-ai-gateway", () => {
  const originalToken = process.env.NEON_AI_GATEWAY_TOKEN
  const originalBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL

  beforeEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_test_token"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL
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
      baseUrl: TEST_NEON_AI_GATEWAY_BASE_URL_V1,
      modelIds: [...NEON_AI_GATEWAY_DEFAULT_MODEL_IDS],
    })
    expect(NEON_AI_GATEWAY_DEFAULT_MODEL).toBe("qwen35-122b-a10b")
  })

  it("returns undefined when gateway env is missing", () => {
    delete process.env.NEON_AI_GATEWAY_TOKEN
    expect(resolveNeonAiGatewayConfig("user-1")).toBeUndefined()
  })

  it("rejects non-neon gateway hosts", () => {
    process.env.NEON_AI_GATEWAY_BASE_URL = "https://evil.example.com"
    expect(resolveNeonAiGatewayConfig("user-1")).toBeUndefined()
  })

  it("keeps gateway config after captureAndScrub removes env", () => {
    captureAndScrubNeonAiGatewayEnv()
    expect(process.env.NEON_AI_GATEWAY_TOKEN).toBeUndefined()
    expect(process.env.NEON_AI_GATEWAY_BASE_URL).toBeUndefined()
    expect(resolveNeonAiGatewayConfig("user-1")).toEqual({
      apiKey: "nt_live_test_token",
      baseUrl: TEST_NEON_AI_GATEWAY_BASE_URL_V1,
      modelIds: [...NEON_AI_GATEWAY_DEFAULT_MODEL_IDS],
    })
  })

  it("does not scrub env when gateway URL is invalid", () => {
    process.env.NEON_AI_GATEWAY_BASE_URL = "https://evil.example.com"
    captureAndScrubNeonAiGatewayEnv()
    expect(process.env.NEON_AI_GATEWAY_TOKEN).toBe("nt_live_test_token")
    expect(process.env.NEON_AI_GATEWAY_BASE_URL).toBe(
      "https://evil.example.com"
    )
    expect(resolveNeonAiGatewayConfig("user-1")).toBeUndefined()
  })

  it("captureAndScrub is idempotent", () => {
    captureAndScrubNeonAiGatewayEnv()
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_reinjected"
    captureAndScrubNeonAiGatewayEnv()
    expect(resolveNeonAiGatewayConfig("user-1")?.apiKey).toBe(
      "nt_live_test_token"
    )
  })
})
