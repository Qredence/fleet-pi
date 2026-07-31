import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TEST_NEON_AI_GATEWAY_BASE_URL } from "./gateway-test-fixtures"
import { createMockSettingsManager } from "./mock-settings-manager"
import type { AppRuntimeContext } from "@/lib/app-runtime"

const mocks = vi.hoisted(() => ({
  createAgentSessionServices: vi.fn(),
  getAgentDir: vi.fn(() => "/tmp/pi-agent"),
  bootstrapAgentWorkspace: vi.fn(),
  withChatPostgresTransaction: vi.fn(),
  decryptString: vi.fn(),
}))

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSessionServices: mocks.createAgentSessionServices,
  getAgentDir: mocks.getAgentDir,
}))

vi.mock("../../workspace/bootstrap-agent-workspace", () => ({
  bootstrapAgentWorkspace: mocks.bootstrapAgentWorkspace,
  createWorkspaceHealthFailure: vi.fn((_context, error) => ({
    status: "degraded",
    workspace: { available: false },
    warnings: [String(error)],
    diagnostics: [],
  })),
}))

vi.mock("@/lib/db/pi-session-mirror", () => ({
  withChatPostgresTransaction: mocks.withChatPostgresTransaction,
}))

vi.mock("@/lib/auth/crypto", () => ({
  decryptString: mocks.decryptString,
}))

describe("session factory", () => {
  const originalVercel = process.env.VERCEL
  const originalGeminiKey = process.env.GEMINI_API_KEY
  const originalAuthSecret = process.env.BETTER_AUTH_SECRET
  const originalChatDb = process.env.FLEET_PI_CHAT_DATABASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createAgentSessionServices.mockResolvedValue({
      modelRuntime: {
        setRuntimeApiKey: vi.fn(),
        removeRuntimeApiKey: vi.fn(),
        unregisterProvider: vi.fn(),
        registerProvider: vi.fn(),
        getRegisteredProviderIds: vi.fn(() => []),
      },
      settingsManager: createMockSettingsManager(),
      resourceLoader: {
        reload: vi.fn(async () => undefined),
      },
      diagnostics: [],
    })
    mocks.bootstrapAgentWorkspace.mockResolvedValue({
      status: "ok",
      workspace: { available: true },
      warnings: [],
      diagnostics: [],
    })
    mocks.withChatPostgresTransaction.mockImplementation(
      async (callback: (client: unknown) => Promise<void>) => {
        await callback({
          query: vi.fn().mockResolvedValue({
            rows: [{ provider_id: "google", encrypted_key: "encrypted" }],
          }),
        })
      }
    )
    mocks.decryptString.mockReturnValue("decrypted-key")
  })

  afterEach(() => {
    process.env.VERCEL = originalVercel
    process.env.GEMINI_API_KEY = originalGeminiKey
    process.env.BETTER_AUTH_SECRET = originalAuthSecret
    process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatDb
    delete process.env.HF_TOKEN
    delete process.env.OPENROUTER_API_KEY
    delete process.env.DAYTONA_API_KEY
    vi.resetModules()
  })

  it("injects BYOK runtime keys for Vercel users", async () => {
    process.env.VERCEL = "1"
    process.env.BETTER_AUTH_SECRET = "auth-secret"
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://chat.test/fleet"
    const { applyRuntimeAuth } = await import("../session-factory")
    const removeRuntimeApiKey = vi.fn()
    const services = {
      modelRuntime: {
        setRuntimeApiKey: vi.fn(),
        removeRuntimeApiKey,
        unregisterProvider: vi.fn(),
        registerProvider: vi.fn(),
        getRegisteredProviderIds: vi.fn(() => []),
      },
    }

    await applyRuntimeAuth(services as never, { userId: "user-1" })

    expect(mocks.withChatPostgresTransaction).toHaveBeenCalled()
    expect(services.modelRuntime.setRuntimeApiKey).toHaveBeenCalledWith(
      "google",
      "decrypted-key"
    )
    expect(removeRuntimeApiKey).toHaveBeenCalled()
  })

  it("syncs local env vars into runtime auth storage", async () => {
    delete process.env.VERCEL
    process.env.GEMINI_API_KEY = "local-gemini-key"
    const { applyRuntimeAuth } = await import("../session-factory")
    const setRuntimeApiKey = vi.fn()
    const removeRuntimeApiKey = vi.fn()
    const services = {
      modelRuntime: {
        setRuntimeApiKey,
        removeRuntimeApiKey,
        unregisterProvider: vi.fn(),
        registerProvider: vi.fn(),
        getRegisteredProviderIds: vi.fn(() => []),
      },
    }

    await applyRuntimeAuth(services as never, {})

    expect(mocks.withChatPostgresTransaction).not.toHaveBeenCalled()
    expect(setRuntimeApiKey).toHaveBeenCalledWith("google", "local-gemini-key")
    expect(removeRuntimeApiKey).toHaveBeenCalled()
  })

  it("scrubs Pi LLM provider env vars including Hugging Face on Vercel", async () => {
    process.env.VERCEL = "1"
    process.env.GEMINI_API_KEY = "secret"
    process.env.HF_TOKEN = "hf-org-token"
    process.env.OPENROUTER_API_KEY = "or-secret"
    process.env.DAYTONA_API_KEY = "daytona-secret"
    const { createSessionServices } = await import("../session-factory")

    await createSessionServices({ projectRoot: "/repo" } as AppRuntimeContext)

    expect(process.env.GEMINI_API_KEY).toBeUndefined()
    expect(process.env.HF_TOKEN).toBeUndefined()
    expect(process.env.OPENROUTER_API_KEY).toBeUndefined()
    // Daytona org keys are scrubbed on Vercel; user BYOK is loaded separately.
    expect(process.env.DAYTONA_API_KEY).toBeUndefined()
    expect(mocks.createAgentSessionServices).toHaveBeenCalled()
  })

  it("scrubs NEON_AI_GATEWAY env on Vercel after capturing credentials", async () => {
    process.env.VERCEL = "1"
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_gateway"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL
    process.env.GEMINI_API_KEY = "secret"
    const { resetCapturedNeonAiGatewayCredentialsForTests } =
      await import("../neon-ai-gateway")
    resetCapturedNeonAiGatewayCredentialsForTests()
    const { createSessionServices } = await import("../session-factory")
    const { resolveNeonAiGatewayConfig } = await import("../neon-ai-gateway")

    await createSessionServices({ projectRoot: "/repo" } as AppRuntimeContext)

    expect(process.env.NEON_AI_GATEWAY_TOKEN).toBeUndefined()
    expect(process.env.NEON_AI_GATEWAY_BASE_URL).toBeUndefined()
    expect(resolveNeonAiGatewayConfig("user-1")?.apiKey).toBe("nt_live_gateway")
    expect(process.env.GEMINI_API_KEY).toBeUndefined()
    resetCapturedNeonAiGatewayCredentialsForTests()
  })

  it("does not fall back to org env LLM keys on Vercel when BYOK is empty", async () => {
    process.env.VERCEL = "1"
    process.env.GEMINI_API_KEY = "org-gemini-key"
    process.env.BETTER_AUTH_SECRET = "auth-secret"
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://chat.test/fleet"
    mocks.withChatPostgresTransaction.mockImplementation(
      async (callback: (client: unknown) => Promise<void>) => {
        await callback({
          query: vi.fn().mockResolvedValue({ rows: [] }),
        })
      }
    )

    const { createSessionServices, applyRuntimeAuth } =
      await import("../session-factory")
    await createSessionServices({ projectRoot: "/repo" } as AppRuntimeContext)

    const setRuntimeApiKey = vi.fn()
    const removeRuntimeApiKey = vi.fn()
    await applyRuntimeAuth(
      {
        modelRuntime: {
          setRuntimeApiKey,
          removeRuntimeApiKey,
          unregisterProvider: vi.fn(),
          registerProvider: vi.fn(),
          getRegisteredProviderIds: vi.fn(() => []),
        },
      } as never,
      { userId: "user-1" }
    )

    expect(process.env.GEMINI_API_KEY).toBeUndefined()
    expect(setRuntimeApiKey).not.toHaveBeenCalledWith(
      "google",
      "org-gemini-key"
    )
    expect(removeRuntimeApiKey).toHaveBeenCalledWith("huggingface")
    expect(removeRuntimeApiKey).toHaveBeenCalledWith("google")
  })
})
