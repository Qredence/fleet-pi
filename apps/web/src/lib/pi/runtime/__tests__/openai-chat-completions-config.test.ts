import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  TEST_NEON_AI_GATEWAY_BASE_URL,
  TEST_NEON_AI_GATEWAY_BASE_URL_V1,
} from "./gateway-test-fixtures"

const mocks = vi.hoisted(() => ({
  resolveUserProviderSecret: vi.fn(),
}))

vi.mock("../user-provider-secrets", () => ({
  resolveUserProviderSecret: mocks.resolveUserProviderSecret,
}))

describe("resolveOpenAiChatCompletionsConfig", () => {
  const originalToken = process.env.NEON_AI_GATEWAY_TOKEN
  const originalBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL
  const originalOccKey = process.env.OPENAI_CHAT_COMPLETIONS_API_KEY
  const originalOccBase = process.env.OPENAI_CHAT_COMPLETIONS_BASE_URL
  const originalOccModel = process.env.OPENAI_CHAT_COMPLETIONS_MODEL

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEON_AI_GATEWAY_TOKEN
    delete process.env.NEON_AI_GATEWAY_BASE_URL
    delete process.env.OPENAI_CHAT_COMPLETIONS_API_KEY
    delete process.env.OPENAI_CHAT_COMPLETIONS_BASE_URL
    delete process.env.OPENAI_CHAT_COMPLETIONS_MODEL
  })

  afterEach(() => {
    process.env.NEON_AI_GATEWAY_TOKEN = originalToken
    process.env.NEON_AI_GATEWAY_BASE_URL = originalBaseUrl
    process.env.OPENAI_CHAT_COMPLETIONS_API_KEY = originalOccKey
    process.env.OPENAI_CHAT_COMPLETIONS_BASE_URL = originalOccBase
    process.env.OPENAI_CHAT_COMPLETIONS_MODEL = originalOccModel
    vi.resetModules()
  })

  it("prefers OCC BYOK over Neon AI Gateway", async () => {
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_gateway"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL

    mocks.resolveUserProviderSecret.mockImplementation(
      async (_userId: string | undefined, providerId: string) => {
        if (providerId === "openai-chat-completions") return "byok-key"
        if (providerId === "openai-chat-completions-base-url") {
          return "https://custom.example/v1"
        }
        if (providerId === "openai-chat-completions-model") {
          return "custom-model"
        }
        return undefined
      }
    )

    const { resolveOpenAiChatCompletionsConfig } =
      await import("../openai-chat-completions-provider")
    const config = await resolveOpenAiChatCompletionsConfig("user-1")

    expect(config).toEqual({
      apiKey: "byok-key",
      baseUrl: "https://custom.example/v1",
      modelIds: ["custom-model"],
    })
  })

  it("ignores legacy OCC BYOK when Neon AI Gateway is active", async () => {
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_gateway"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL

    mocks.resolveUserProviderSecret.mockImplementation(
      async (_userId: string | undefined, providerId: string) => {
        if (providerId === "openai-chat-completions") return "byok-key"
        if (providerId === "openai-chat-completions-base-url") {
          return "https://custom.example/v1"
        }
        if (providerId === "openai-chat-completions-model") {
          return "deepseek-v4-flash-free"
        }
        return undefined
      }
    )

    const { resolveOpenAiChatCompletionsConfig } =
      await import("../openai-chat-completions-provider")
    const config = await resolveOpenAiChatCompletionsConfig("user-1")

    expect(config).toEqual({
      apiKey: "nt_live_gateway",
      baseUrl: TEST_NEON_AI_GATEWAY_BASE_URL_V1,
      modelIds: ["qwen35-122b-a10b", "gpt-oss-120b"],
    })
  })

  it("falls back to Neon AI Gateway for authenticated users without OCC BYOK", async () => {
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_gateway"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL
    mocks.resolveUserProviderSecret.mockResolvedValue(undefined)

    const { resolveOpenAiChatCompletionsConfig } =
      await import("../openai-chat-completions-provider")
    const config = await resolveOpenAiChatCompletionsConfig("user-1")

    expect(config).toEqual({
      apiKey: "nt_live_gateway",
      baseUrl: TEST_NEON_AI_GATEWAY_BASE_URL_V1,
      modelIds: ["qwen35-122b-a10b", "gpt-oss-120b"],
    })
  })

  it("returns undefined without user id even when gateway env is set", async () => {
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_gateway"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL
    mocks.resolveUserProviderSecret.mockResolvedValue(undefined)

    const { resolveOpenAiChatCompletionsConfig } =
      await import("../openai-chat-completions-provider")
    expect(await resolveOpenAiChatCompletionsConfig(undefined)).toBeUndefined()
  })
})
