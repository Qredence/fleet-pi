import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAgentSessionServices } from "@earendil-works/pi-coding-agent"
import {
  CUSTOM_PROVIDER_ID_PREFIX,
  OCC_INSTANCE_ID_PREFIX,
} from "@workspace/pi-protocol/provider-catalog"
import { registerCustomProviders } from "../custom-provider-registry"
import { resetCapturedNeonAiGatewayCredentialsForTests } from "../neon-ai-gateway"
import { OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } from "../openai-chat-completions-compat"
import { registerOpenAiChatCompletionsProvider } from "../openai-chat-completions-provider"
import { TEST_NEON_AI_GATEWAY_BASE_URL } from "./gateway-test-fixtures"

const { listOccInstancesMock, loadOccInstanceApiKeyMock } = vi.hoisted(() => ({
  listOccInstancesMock: vi.fn(),
  loadOccInstanceApiKeyMock: vi.fn(),
}))

vi.mock("@/lib/db/occ-instances", () => ({
  listOccInstances: listOccInstancesMock,
  loadOccInstanceApiKey: loadOccInstanceApiKeyMock,
}))

describe("registerOpenAiChatCompletionsProvider gateway compat", () => {
  const originalToken = process.env.NEON_AI_GATEWAY_TOKEN
  const originalBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL

  beforeEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    vi.clearAllMocks()
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_test_token"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL
  })

  afterEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = originalToken
    process.env.NEON_AI_GATEWAY_BASE_URL = originalBaseUrl
  })

  it("registers gateway models with Neon-safe compat flags", async () => {
    const services = await createAgentSessionServices({
      cwd: process.cwd(),
    })
    await registerOpenAiChatCompletionsProvider(services, "user-1")

    const model = services.modelRuntime.getModel(
      "openai-chat-completions",
      "qwen35-122b-a10b"
    )
    expect(model).toBeDefined()
    expect(model?.compat).toMatchObject(OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT)
    expect(model?.maxTokens).toBe(25_000)
  })

  it("registers each named OCC instance as its own provider + model", async () => {
    listOccInstancesMock.mockResolvedValue([
      {
        id: `${OCC_INSTANCE_ID_PREFIX}nebius`,
        displayName: "Nebius AI",
        baseUrl: "https://api.nebius.com/v1",
        modelId: "deepseek-v3",
      },
      {
        id: `${OCC_INSTANCE_ID_PREFIX}zen`,
        displayName: "OpenCode Zen",
        baseUrl: "https://opencode.ai/zen/v1",
        modelId: "kimi-k2.6",
      },
    ])
    loadOccInstanceApiKeyMock.mockImplementation(
      async (_userId: string, id: string) => `key-for-${id}`
    )

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    await registerCustomProviders(services, "user-1")

    for (const id of [
      `${OCC_INSTANCE_ID_PREFIX}nebius`,
      `${OCC_INSTANCE_ID_PREFIX}zen`,
    ]) {
      const provider = services.modelRuntime.getProvider(id)
      expect(provider).toBeDefined()
      const modelId = id.endsWith("nebius") ? "deepseek-v3" : "kimi-k2.6"
      const model = services.modelRuntime.getModel(id, modelId)
      expect(model).toBeDefined()
      // Non-gateway OCC hosts keep 32k and the OpenAI auto-detect compat (no gateway flags).
      expect(model?.maxTokens).toBe(32_000)
    }
  })

  it("applies the gateway 25k cap to an instance whose host is a Neon AI Gateway host", async () => {
    listOccInstancesMock.mockResolvedValue([
      {
        id: `${OCC_INSTANCE_ID_PREFIX}gw`,
        displayName: "Team Gateway",
        baseUrl: "https://br-foo-api.ai.c-3.us-east-2.aws.neon.tech/v1",
        modelId: "qwen35-122b-a10b",
      },
    ])
    loadOccInstanceApiKeyMock.mockResolvedValue("gw-key")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    await registerCustomProviders(services, "user-1")

    const model = services.modelRuntime.getModel(
      `${OCC_INSTANCE_ID_PREFIX}gw`,
      "qwen35-122b-a10b"
    )
    expect(model).toBeDefined()
    expect(model?.maxTokens).toBe(25_000)
    expect(model?.compat).toMatchObject(OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT)
  })

  it("applies the gateway 25k cap to an openai-responses custom provider on a gateway host", async () => {
    listOccInstancesMock.mockResolvedValue([
      {
        id: `${CUSTOM_PROVIDER_ID_PREFIX}responses-gw`,
        displayName: "Responses Gateway",
        baseUrl: "https://br-foo-api.ai.c-3.us-east-2.aws.neon.tech/v1",
        modelId: "gpt-5",
        api: "openai-responses",
        modelIds: ["gpt-5"],
      },
    ])
    loadOccInstanceApiKeyMock.mockResolvedValue("gw-key")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    await registerCustomProviders(services, "user-1")

    const model = services.modelRuntime.getModel(
      `${CUSTOM_PROVIDER_ID_PREFIX}responses-gw`,
      "gpt-5"
    )
    expect(model).toBeDefined()
    expect(model?.maxTokens).toBe(25_000)
    expect(model?.compat).toMatchObject(OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT)
  })

  it("deduplicates skip diagnostics across repeated registerCustomProviders calls", async () => {
    listOccInstancesMock.mockResolvedValue([
      {
        id: `${OCC_INSTANCE_ID_PREFIX}broken-key`,
        displayName: "Broken Key",
        baseUrl: "https://opencode.ai/zen/v1",
        modelId: "kimi-k2.6",
      },
    ])
    loadOccInstanceApiKeyMock.mockResolvedValue(undefined)

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    const diagnosticsBefore = services.diagnostics.length
    await registerCustomProviders(services, "user-1")
    await registerCustomProviders(services, "user-1")

    const newDiagnostics = services.diagnostics.slice(diagnosticsBefore)
    const brokenKeyWarnings = newDiagnostics.filter(
      (d) => d.message.includes("broken-key") && d.message.includes("skipped")
    )
    expect(brokenKeyWarnings).toHaveLength(1)
  })

  it("registers a general custom provider with an Anthropic-compatible API family", async () => {
    listOccInstancesMock.mockResolvedValue([
      {
        id: `${CUSTOM_PROVIDER_ID_PREFIX}claude-proxy`,
        displayName: "Claude Proxy",
        baseUrl: "https://proxy.example.com",
        modelId: "claude-sonnet-4",
        api: "anthropic-messages",
        modelIds: ["claude-sonnet-4"],
      },
    ])
    loadOccInstanceApiKeyMock.mockResolvedValue("claude-key")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    await registerCustomProviders(services, "user-1")

    const model = services.modelRuntime.getModel(
      `${CUSTOM_PROVIDER_ID_PREFIX}claude-proxy`,
      "claude-sonnet-4"
    )
    expect(model).toBeDefined()
    expect(model?.api).toBe("anthropic-messages")
    expect(model?.maxTokens).toBe(32_000)
  })

  it("maps the google-genai protocol family to Pi's google-generative-ai", async () => {
    listOccInstancesMock.mockResolvedValue([
      {
        id: `${CUSTOM_PROVIDER_ID_PREFIX}gemini-proxy`,
        displayName: "Gemini Proxy",
        baseUrl: "https://gateway.example.com",
        modelId: "gemini-2.0-flash",
        api: "google-genai",
        modelIds: ["gemini-2.0-flash"],
      },
    ])
    loadOccInstanceApiKeyMock.mockResolvedValue("gemini-key")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    await registerCustomProviders(services, "user-1")

    const model = services.modelRuntime.getModel(
      `${CUSTOM_PROVIDER_ID_PREFIX}gemini-proxy`,
      "gemini-2.0-flash"
    )
    expect(model).toBeDefined()
    expect(model?.api).toBe("google-generative-ai")
  })

  it("emits a diagnostic for instances that cannot be registered", async () => {
    listOccInstancesMock.mockResolvedValue([
      {
        id: `${OCC_INSTANCE_ID_PREFIX}broken-key`,
        displayName: "Broken Key",
        baseUrl: "https://opencode.ai/zen/v1",
        modelId: "kimi-k2.6",
      },
      {
        id: `${OCC_INSTANCE_ID_PREFIX}bad-url`,
        displayName: "Bad URL",
        baseUrl: "not-a-url",
        modelId: "kimi-k2.6",
      },
    ])
    loadOccInstanceApiKeyMock.mockImplementation(
      async (_userId: string, id: string) =>
        id.endsWith("broken-key") ? undefined : "valid-key"
    )

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    const diagnosticsBefore = services.diagnostics.length
    await registerCustomProviders(services, "user-1")

    const newDiagnostics = services.diagnostics.slice(diagnosticsBefore)
    const messages = newDiagnostics.map((d) => d.message).join("\n")
    expect(messages).toContain("broken-key")
    expect(messages).toContain("could not be read")
    expect(messages).toContain("bad-url")
    expect(messages).toContain("base URL failed validation")
    // Neither broken instance registered.
    expect(
      services.modelRuntime.getModel(
        `${OCC_INSTANCE_ID_PREFIX}broken-key`,
        "kimi-k2.6"
      )
    ).toBeUndefined()
  })

  it("drops stale named instances not in the user's current set", async () => {
    const staleId = `${OCC_INSTANCE_ID_PREFIX}stale`
    listOccInstancesMock.mockResolvedValue([])

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    const unregisterSpy = vi.spyOn(services.modelRuntime, "unregisterProvider")
    // Register the stale instance first via a prior pass.
    listOccInstancesMock.mockResolvedValue([
      {
        id: staleId,
        displayName: "Stale",
        baseUrl: "https://opencode.ai/zen/v1",
        modelId: "kimi-k2.6",
      },
    ])
    loadOccInstanceApiKeyMock.mockResolvedValue("stale-key")
    await registerCustomProviders(services, "user-1")
    expect(services.modelRuntime.getModel(staleId, "kimi-k2.6")).toBeDefined()

    // Now the user removed it.
    listOccInstancesMock.mockResolvedValue([])
    await registerCustomProviders(services, "user-1")

    expect(services.modelRuntime.getModel(staleId, "kimi-k2.6")).toBeUndefined()
    expect(unregisterSpy).toHaveBeenCalledWith(staleId)
  })
})
