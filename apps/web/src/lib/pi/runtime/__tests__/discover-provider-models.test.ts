import { afterEach, describe, expect, it, vi } from "vitest"
import { CUSTOM_PROVIDER_ID_PREFIX } from "@workspace/pi-protocol/provider-catalog"
import { discoverConfiguredProviderModels } from "../discover-provider-models"
import { TEST_NEON_AI_GATEWAY_BASE_URL } from "./gateway-test-fixtures"

const { getOccInstanceByIdMock, loadOccInstanceApiKeyMock } = vi.hoisted(
  () => ({
    getOccInstanceByIdMock: vi.fn(),
    loadOccInstanceApiKeyMock: vi.fn(),
  })
)

const { resolveOpenAiChatCompletionsConfigMock } = vi.hoisted(() => ({
  resolveOpenAiChatCompletionsConfigMock: vi.fn(),
}))

vi.mock("@/lib/db/occ-instances", () => ({
  getOccInstanceById: getOccInstanceByIdMock,
  loadOccInstanceApiKey: loadOccInstanceApiKeyMock,
}))

vi.mock("@/lib/db/local-provider-instances", () => ({
  getLocalProviderInstance: vi.fn(),
  loadLocalProviderInstanceApiKey: vi.fn(),
  useLocalProviderStore: vi.fn(() => false),
}))

vi.mock("../openai-chat-completions-provider", () => ({
  resolveOpenAiChatCompletionsConfig: resolveOpenAiChatCompletionsConfigMock,
}))

const commandCodeCatalog = {
  object: "list",
  data: [
    {
      id: "claude-sonnet-5-5",
      name: "Claude Sonnet 5.5",
      supported_endpoints: ["/messages"],
    },
    {
      id: "deepseek/deepseek-v4-flash",
      name: "DeepSeek V4 Flash (latest)",
      context_length: 1_000_000,
      supported_endpoints: ["/chat/completions", "/responses"],
    },
    {
      id: "gpt-5.5",
      name: "GPT-5.5",
      supported_endpoints: ["/chat/completions", "/responses"],
    },
  ],
}

describe("discoverConfiguredProviderModels", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it("lists Command Code chat models and hides messages-only Claude models", async () => {
    const providerId = `${CUSTOM_PROVIDER_ID_PREFIX}command-code`
    getOccInstanceByIdMock.mockResolvedValue({
      id: providerId,
      displayName: "Command Code",
      baseUrl: "https://api.commandcode.ai/provider/v1",
      api: "openai-completions",
      modelId: "deepseek/deepseek-v4-flash",
      modelIds: ["deepseek/deepseek-v4-flash"],
    })
    loadOccInstanceApiKeyMock.mockResolvedValue("cmd-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(commandCodeCatalog), { status: 200 })
        )
      )
    )

    const discovered = await discoverConfiguredProviderModels(
      "user-1",
      providerId
    )
    expect(discovered.status).toBe("models")
    if (discovered.status !== "models") return
    expect(discovered.models.map((model) => model.id)).toEqual([
      "deepseek/deepseek-v4-flash",
      "gpt-5.5",
    ])
    expect(discovered.models[0]).toMatchObject({
      name: "DeepSeek V4 Flash (latest)",
      provider: providerId,
      contextWindow: 1_000_000,
    })
  })

  it("returns unknown when the custom provider is not stored", async () => {
    getOccInstanceByIdMock.mockResolvedValue(null)
    const discovered = await discoverConfiguredProviderModels(
      "user-1",
      `${CUSTOM_PROVIDER_ID_PREFIX}missing`
    )
    expect(discovered).toEqual({ status: "unknown" })
  })

  it("does not fetch a gateway-backed reserved OCC slot", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    resolveOpenAiChatCompletionsConfigMock.mockResolvedValue({
      apiKey: "gw",
      baseUrl: TEST_NEON_AI_GATEWAY_BASE_URL,
      modelIds: ["qwen35-122b-a10b"],
    })
    const discovered = await discoverConfiguredProviderModels(
      "user-1",
      "openai-chat-completions"
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(discovered.status).toBe("models")
    if (discovered.status !== "models") return
    expect(discovered.models.map((model) => model.id)).toEqual([
      "qwen35-122b-a10b",
    ])
  })
})
