import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAgentSessionServices } from "@earendil-works/pi-coding-agent"
import {
  CUSTOM_PROVIDER_ID_PREFIX,
  OCC_INSTANCE_ID_PREFIX,
} from "@workspace/pi-protocol/provider-catalog"
import { registerCustomProviders } from "../custom-provider-registry"
import { resetCapturedNeonAiGatewayCredentialsForTests } from "../neon-ai-gateway"
import { OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } from "../openai-chat-completions-compat"
import { TEST_NEON_AI_GATEWAY_BASE_URL } from "./gateway-test-fixtures"

const {
  listOccInstancesMock,
  loadOccInstanceApiKeyMock,
  listLocalProviderInstancesMock,
  loadLocalProviderInstanceApiKeyMock,
  useLocalProviderStoreMock,
} = vi.hoisted(() => ({
  listOccInstancesMock: vi.fn(),
  loadOccInstanceApiKeyMock: vi.fn(),
  listLocalProviderInstancesMock: vi.fn(),
  loadLocalProviderInstanceApiKeyMock: vi.fn(),
  useLocalProviderStoreMock: vi.fn(() => true),
}))

vi.mock("@/lib/db/occ-instances", () => ({
  listOccInstances: listOccInstancesMock,
  loadOccInstanceApiKey: loadOccInstanceApiKeyMock,
}))

vi.mock("@/lib/db/local-provider-instances", () => ({
  listLocalProviderInstances: listLocalProviderInstancesMock,
  loadLocalProviderInstanceApiKey: loadLocalProviderInstanceApiKeyMock,
  useLocalProviderStore: useLocalProviderStoreMock,
}))

describe("registerCustomProviders with the local file store", () => {
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
    if (originalToken === undefined) delete process.env.NEON_AI_GATEWAY_TOKEN
    else process.env.NEON_AI_GATEWAY_TOKEN = originalToken
    if (originalBaseUrl === undefined)
      delete process.env.NEON_AI_GATEWAY_BASE_URL
    else process.env.NEON_AI_GATEWAY_BASE_URL = originalBaseUrl
  })

  it("registers local custom providers using their stored apiKey, without the DB loader", async () => {
    const localId = `${CUSTOM_PROVIDER_ID_PREFIX}local`
    listLocalProviderInstancesMock.mockResolvedValue([
      {
        id: localId,
        displayName: "Local Endpoint",
        baseUrl: "https://api.example.com/v1",
        modelId: "gpt-compatible",
        api: "openai-completions",
        modelIds: ["gpt-compatible"],
      },
    ])
    loadLocalProviderInstanceApiKeyMock.mockResolvedValue("sk-local")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    await registerCustomProviders(services, undefined)

    expect(useLocalProviderStoreMock).toHaveBeenCalledWith(undefined)
    expect(listLocalProviderInstancesMock).toHaveBeenCalledWith(undefined)
    expect(loadLocalProviderInstanceApiKeyMock).toHaveBeenCalledWith(
      undefined,
      localId
    )
    expect(listOccInstancesMock).not.toHaveBeenCalled()
    expect(loadOccInstanceApiKeyMock).not.toHaveBeenCalled()

    const provider = services.modelRuntime.getProvider(localId)
    expect(provider).toBeDefined()
    const model = services.modelRuntime.getModel(localId, "gpt-compatible")
    expect(model).toBeDefined()
    expect(model?.maxTokens).toBe(32_000)
  })

  it("registers a local named OCC instance in the occ namespace", async () => {
    const occId = `${OCC_INSTANCE_ID_PREFIX}local-occ`
    listLocalProviderInstancesMock.mockResolvedValue([
      {
        id: occId,
        displayName: "Local OCC",
        baseUrl: "https://api.example.com/v1",
        modelId: "kimi-k2.6",
        api: "openai-completions",
        modelIds: ["kimi-k2.6"],
      },
    ])
    loadLocalProviderInstanceApiKeyMock.mockResolvedValue("sk-occ")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    await registerCustomProviders(services, undefined)

    const model = services.modelRuntime.getModel(occId, "kimi-k2.6")
    expect(model).toBeDefined()
    expect(model?.maxTokens).toBe(32_000)
  })

  it("applies the gateway 25k cap to a local provider on a gateway host", async () => {
    const localId = `${CUSTOM_PROVIDER_ID_PREFIX}gw`
    listLocalProviderInstancesMock.mockResolvedValue([
      {
        id: localId,
        displayName: "Local Gateway",
        baseUrl: "https://br-foo-api.ai.c-3.us-east-2.aws.neon.tech/v1",
        modelId: "qwen35-122b-a10b",
        api: "openai-completions",
        modelIds: ["qwen35-122b-a10b"],
      },
    ])
    loadLocalProviderInstanceApiKeyMock.mockResolvedValue("gw-key")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    await registerCustomProviders(services, undefined)

    const model = services.modelRuntime.getModel(localId, "qwen35-122b-a10b")
    expect(model).toBeDefined()
    expect(model?.maxTokens).toBe(25_000)
    expect(model?.compat).toMatchObject(OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT)
  })

  it("registers a local OCC-family provider with a loopback http base URL", async () => {
    const localId = `${OCC_INSTANCE_ID_PREFIX}ollama`
    listLocalProviderInstancesMock.mockResolvedValue([
      {
        id: localId,
        displayName: "Local Ollama",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama-3.2",
        api: "openai-completions",
        modelIds: ["llama-3.2"],
      },
    ])
    loadLocalProviderInstanceApiKeyMock.mockResolvedValue("sk-local")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    await registerCustomProviders(services, undefined)

    const model = services.modelRuntime.getModel(localId, "llama-3.2")
    expect(model).toBeDefined()
  })

  it("emits a skip diagnostic when a local instance's apiKey cannot be read", async () => {
    const localId = `${CUSTOM_PROVIDER_ID_PREFIX}empty-key`
    listLocalProviderInstancesMock.mockResolvedValue([
      {
        id: localId,
        displayName: "Empty Key",
        baseUrl: "https://api.example.com/v1",
        modelId: "gpt-compatible",
        api: "openai-completions",
        modelIds: ["gpt-compatible"],
      },
    ])
    loadLocalProviderInstanceApiKeyMock.mockResolvedValue("")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    const diagnosticsBefore = services.diagnostics.length
    await registerCustomProviders(services, undefined)

    const newDiagnostics = services.diagnostics.slice(diagnosticsBefore)
    const messages = newDiagnostics.map((d) => d.message).join("\n")
    expect(messages).toContain("empty-key")
    expect(messages).toContain("could not be read")
    expect(
      services.modelRuntime.getModel(localId, "gpt-compatible")
    ).toBeUndefined()
  })

  it("degrades to a diagnostic instead of bricking chat when the store is unreadable", async () => {
    listLocalProviderInstancesMock.mockRejectedValue(
      new Error(
        "Malformed local provider store at /repo/.fleet/providers.anonymous.json"
      )
    )

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    const diagnosticsBefore = services.diagnostics.length
    await expect(
      registerCustomProviders(services, undefined)
    ).resolves.toBeUndefined()

    const newDiagnostics = services.diagnostics.slice(diagnosticsBefore)
    const messages = newDiagnostics.map((d) => d.message).join("\n")
    expect(messages).toContain("Local provider store is unreadable")
    expect(loadLocalProviderInstanceApiKeyMock).not.toHaveBeenCalled()
  })

  it("degrades to a diagnostic when the apiKey read fails after discovery succeeded", async () => {
    const localId = `${CUSTOM_PROVIDER_ID_PREFIX}key-read-fails`
    listLocalProviderInstancesMock.mockResolvedValue([
      {
        id: localId,
        displayName: "Key Read Fails",
        baseUrl: "https://api.example.com/v1",
        modelId: "gpt-compatible",
        api: "openai-completions",
        modelIds: ["gpt-compatible"],
      },
    ])
    loadLocalProviderInstanceApiKeyMock.mockRejectedValue(
      new Error(
        "Malformed local provider store at /repo/.fleet/providers.anonymous.json"
      )
    )

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    const diagnosticsBefore = services.diagnostics.length
    await expect(
      registerCustomProviders(services, undefined)
    ).resolves.toBeUndefined()

    const newDiagnostics = services.diagnostics.slice(diagnosticsBefore)
    const messages = newDiagnostics.map((d) => d.message).join("\n")
    expect(messages).toContain("Local provider store is unreadable")
    expect(
      services.modelRuntime.getModel(localId, "gpt-compatible")
    ).toBeUndefined()
  })

  it("unregisters a stale local provider that is no longer configured", async () => {
    const localId = `${CUSTOM_PROVIDER_ID_PREFIX}stale`
    listLocalProviderInstancesMock.mockResolvedValue([
      {
        id: localId,
        displayName: "Stale",
        baseUrl: "https://api.example.com/v1",
        modelId: "gpt-compatible",
        api: "openai-completions",
        modelIds: ["gpt-compatible"],
      },
    ])
    loadLocalProviderInstanceApiKeyMock.mockResolvedValue("sk-stale")

    const services = await createAgentSessionServices({ cwd: process.cwd() })
    const unregisterSpy = vi.spyOn(services.modelRuntime, "unregisterProvider")
    await registerCustomProviders(services, undefined)
    expect(
      services.modelRuntime.getModel(localId, "gpt-compatible")
    ).toBeDefined()

    listLocalProviderInstancesMock.mockResolvedValue([])
    await registerCustomProviders(services, undefined)

    expect(
      services.modelRuntime.getModel(localId, "gpt-compatible")
    ).toBeUndefined()
    expect(unregisterSpy).toHaveBeenCalledWith(localId)
  })
})
