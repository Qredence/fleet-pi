import { afterEach, describe, expect, it, vi } from "vitest"
import {
  listOpenAiCompatibleModels,
  modelSupportsProviderApi,
  parseOpenAiModelsList,
} from "../openai-models-list"
import { TEST_NEON_AI_GATEWAY_BASE_URL } from "./gateway-test-fixtures"

const commandCodeCatalog = {
  object: "list",
  data: [
    {
      id: "claude-sonnet-5-5",
      name: "Claude Sonnet 5.5",
      context_length: 1_000_000,
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
    {
      id: "deepseek/deepseek-v4-flash-fast",
      name: "DeepSeek V4 Flash Fast",
      supported_endpoints: ["/chat/completions"],
    },
  ],
}

describe("parseOpenAiModelsList", () => {
  it("keeps Command Code ids, names, context, and endpoints", () => {
    const models = parseOpenAiModelsList(commandCodeCatalog)
    expect(models.map((model) => model.id)).toEqual([
      "claude-sonnet-5-5",
      "deepseek/deepseek-v4-flash",
      "gpt-5.5",
      "deepseek/deepseek-v4-flash-fast",
    ])
    expect(models[1]).toMatchObject({
      name: "DeepSeek V4 Flash (latest)",
      contextWindow: 1_000_000,
      endpoints: ["/chat/completions", "/responses"],
    })
  })

  it("accepts a models array and string rows", () => {
    expect(
      parseOpenAiModelsList({
        models: ["gpt-4o", { id: "gpt-4o" }, { name: "only-name" }],
      }).map((model) => model.id)
    ).toEqual(["gpt-4o", "only-name"])
  })
})

describe("modelSupportsProviderApi", () => {
  const models = parseOpenAiModelsList(commandCodeCatalog)

  it("keeps chat-completions models and drops messages-only Claude models", () => {
    const ids = models
      .filter((model) => modelSupportsProviderApi(model, "openai-completions"))
      .map((model) => model.id)
    expect(ids).toEqual([
      "deepseek/deepseek-v4-flash",
      "gpt-5.5",
      "deepseek/deepseek-v4-flash-fast",
    ])
  })

  it("keeps only Claude models for the Anthropic wire", () => {
    const ids = models
      .filter((model) => modelSupportsProviderApi(model, "anthropic-messages"))
      .map((model) => model.id)
    expect(ids).toEqual(["claude-sonnet-5-5"])
  })

  it("drops responses-incapable models from the responses wire", () => {
    const ids = models
      .filter((model) => modelSupportsProviderApi(model, "openai-responses"))
      .map((model) => model.id)
    expect(ids).not.toContain("deepseek/deepseek-v4-flash-fast")
    expect(ids).toContain("gpt-5.5")
  })

  it("keeps generic OpenAI rows that omit supported_endpoints", () => {
    expect(
      modelSupportsProviderApi({ id: "gpt-4o" }, "openai-completions")
    ).toBe(true)
  })
})

describe("listOpenAiCompatibleModels", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does not call a Neon AI Gateway host", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(
      listOpenAiCompatibleModels(TEST_NEON_AI_GATEWAY_BASE_URL, "token")
    ).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requests {baseUrl}/models with the bearer key", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(commandCodeCatalog), { status: 200 })
      )
    )
    vi.stubGlobal("fetch", fetchMock)
    const models = await listOpenAiCompatibleModels(
      "https://api.commandcode.ai/provider/v1",
      "cmd-key"
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.commandcode.ai/provider/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer cmd-key",
        }),
      })
    )
    expect(models).toHaveLength(4)
  })
})
