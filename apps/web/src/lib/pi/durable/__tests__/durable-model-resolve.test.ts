import { beforeEach, describe, expect, it, vi } from "vitest"
import { TEST_NEON_AI_GATEWAY_BASE_URL } from "../../runtime/__tests__/gateway-test-fixtures"
import { NEON_AI_GATEWAY_DEFAULT_MODEL } from "../../runtime/neon-ai-gateway"

const mocks = vi.hoisted(() => ({
  listCustomProviderRegistrations: vi.fn(),
  resolveOpenAiChatCompletionsConfig: vi.fn(),
  resolveUserProviderSecret: vi.fn(),
  loadUserProjectSettings: vi.fn(),
}))

vi.mock("../../runtime/custom-provider-registry", () => ({
  listCustomProviderRegistrations: mocks.listCustomProviderRegistrations,
  toPiApi: (api: string) => api,
}))

vi.mock("../../runtime/openai-chat-completions-provider", () => ({
  resolveOpenAiChatCompletionsConfig: mocks.resolveOpenAiChatCompletionsConfig,
}))

vi.mock("../../runtime/user-provider-secrets", () => ({
  resolveUserProviderSecret: mocks.resolveUserProviderSecret,
}))

vi.mock("@/lib/db/user-settings", () => ({
  loadUserProjectSettings: mocks.loadUserProjectSettings,
}))

describe("resolveDurableAgentModel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listCustomProviderRegistrations.mockResolvedValue({
      registrations: [],
    })
    mocks.resolveUserProviderSecret.mockResolvedValue(undefined)
    mocks.loadUserProjectSettings.mockResolvedValue(null)
  })

  it("remaps stale openai provider selections onto the OCC slot", async () => {
    mocks.resolveOpenAiChatCompletionsConfig.mockResolvedValue({
      apiKey: "gateway-key",
      baseUrl: "https://gateway.example/v1",
      modelIds: ["qwen35-122b-a10b", "gpt-oss-120b"],
    })

    const { resolveDurableAgentModel } =
      await import("../durable-model-resolve")
    await expect(
      resolveDurableAgentModel("user-1", {
        provider: "openai",
        id: "qwen35-122b-a10b",
      })
    ).resolves.toEqual({
      provider: "openai-chat-completions",
      modelId: "qwen35-122b-a10b",
      apiKey: "gateway-key",
      baseUrl: "https://gateway.example/v1",
      api: "openai-completions",
    })
  })

  it("falls back to the gateway default for legacy OCC ids", async () => {
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_test"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL
    mocks.resolveOpenAiChatCompletionsConfig.mockResolvedValue({
      apiKey: "gateway-key",
      baseUrl: "https://gateway.example/v1",
      modelIds: [NEON_AI_GATEWAY_DEFAULT_MODEL, "gpt-oss-120b"],
    })

    const { resolveDurableAgentModel } =
      await import("../durable-model-resolve")
    await expect(
      resolveDurableAgentModel("user-1", {
        provider: "openai-chat-completions",
        id: "deepseek-v4-flash-free",
      })
    ).resolves.toMatchObject({
      provider: "openai-chat-completions",
      modelId: NEON_AI_GATEWAY_DEFAULT_MODEL,
    })
    delete process.env.NEON_AI_GATEWAY_TOKEN
    delete process.env.NEON_AI_GATEWAY_BASE_URL
  })

  it("returns a custom provider when registered", async () => {
    mocks.listCustomProviderRegistrations.mockResolvedValue({
      registrations: [
        {
          id: "custom+demo",
          apiKey: "custom-key",
          baseUrl: "https://demo.example/v1",
          api: "openai-completions",
          modelIds: ["demo-model"],
        },
      ],
    })

    const { resolveDurableAgentModel } =
      await import("../durable-model-resolve")
    await expect(
      resolveDurableAgentModel("user-1", {
        provider: "custom+demo",
        id: "demo-model",
      })
    ).resolves.toMatchObject({
      provider: "custom+demo",
      modelId: "demo-model",
    })
  })

  it("denies disabled model selections", async () => {
    mocks.resolveOpenAiChatCompletionsConfig.mockResolvedValue({
      apiKey: "gateway-key",
      baseUrl: "https://gateway.example/v1",
      modelIds: ["qwen35-122b-a10b"],
    })
    mocks.loadUserProjectSettings.mockResolvedValue({
      enabledModels: [],
    })

    const { resolveDurableAgentModel } =
      await import("../durable-model-resolve")
    await expect(
      resolveDurableAgentModel("user-1", {
        provider: "openai-chat-completions",
        id: "qwen35-122b-a10b",
      })
    ).resolves.toBeUndefined()
  })

  it("resolves a configured built-in BYOK provider such as google or anthropic", async () => {
    mocks.resolveUserProviderSecret.mockImplementation(
      (_userId: string | undefined, providerId: string) =>
        Promise.resolve(providerId === "google" ? "gemini-byok-key" : undefined)
    )

    const { resolveDurableAgentModel } =
      await import("../durable-model-resolve")
    await expect(
      resolveDurableAgentModel("user-1", {
        provider: "google",
        id: "gemini-2.5-flash",
      })
    ).resolves.toEqual({
      provider: "google",
      modelId: "gemini-2.5-flash",
      apiKey: "gemini-byok-key",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      api: "google-generative-ai",
    })
  })
})
