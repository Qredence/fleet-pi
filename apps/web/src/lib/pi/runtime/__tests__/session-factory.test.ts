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

vi.mock("../../../workspace/bootstrap-agent-workspace", () => ({
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

vi.mock("@/lib/db/local-provider-instances", () => ({
  listLocalProviderInstances: vi.fn(() => []),
  loadLocalProviderInstanceApiKey: vi.fn(() => ""),
  useLocalProviderStore: vi.fn(() => true),
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
        getProviderAuthStatus: vi.fn(() => ({ configured: false })),
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
        getProviderAuthStatus: vi.fn(() => ({ configured: false })),
      },
    }
    await applyRuntimeAuth(services as never, { userId: "user-1" })
    expect(mocks.withChatPostgresTransaction).toHaveBeenCalled()
    expect(services.modelRuntime.setRuntimeApiKey).toHaveBeenCalledWith(
      "google",
      "decrypted-key",
      { allowNetwork: false }
    )
    // Fresh runtimes hold no Fleet-set runtime keys, so nothing is cleared.
    expect(removeRuntimeApiKey).not.toHaveBeenCalled()
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
        getProviderAuthStatus: vi.fn(() => ({ configured: false })),
      },
    }
    await applyRuntimeAuth(services as never, {})
    expect(mocks.withChatPostgresTransaction).not.toHaveBeenCalled()
    expect(setRuntimeApiKey).toHaveBeenCalledWith(
      "google",
      "local-gemini-key",
      {
        allowNetwork: false,
      }
    )
    expect(removeRuntimeApiKey).not.toHaveBeenCalled()
  })

  it("only touches configured providers and clears stale runtime keys", async () => {
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
        getRegisteredProviderIds: vi.fn(() => [
          "amazon-bedrock",
          "huggingface",
          "google",
        ]),
        getProviderAuthStatus: vi.fn((providerId: string) =>
          providerId === "amazon-bedrock"
            ? { configured: true, source: "runtime" as const }
            : { configured: false }
        ),
      },
    }
    await applyRuntimeAuth(services as never, {})
    // Only env-configured providers get runtime keys — never a sweep of the
    // full Pi provider catalog.
    expect(setRuntimeApiKey).toHaveBeenCalledWith(
      "google",
      "local-gemini-key",
      {
        allowNetwork: false,
      }
    )
    expect(setRuntimeApiKey).not.toHaveBeenCalledWith(
      "huggingface",
      expect.anything()
    )
    expect(setRuntimeApiKey).not.toHaveBeenCalledWith(
      "amazon-bedrock",
      expect.anything()
    )
    expect(setRuntimeApiKey).not.toHaveBeenCalledWith(
      "deepseek",
      expect.anything()
    )
    // The stale runtime key Fleet set earlier is cleared; providers that were
    // never set (huggingface) are left untouched.
    expect(removeRuntimeApiKey).toHaveBeenCalledTimes(1)
    expect(removeRuntimeApiKey).toHaveBeenCalledWith("amazon-bedrock")
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
          getProviderAuthStatus: vi.fn(() => ({ configured: false })),
        },
      } as never,
      { userId: "user-1" }
    )
    expect(process.env.GEMINI_API_KEY).toBeUndefined()
    expect(setRuntimeApiKey).not.toHaveBeenCalledWith(
      "google",
      "org-gemini-key"
    )
    // No configured providers and no Fleet-set runtime keys: nothing is set or
    // cleared — the catalog is never swept.
    expect(setRuntimeApiKey).not.toHaveBeenCalled()
    expect(removeRuntimeApiKey).not.toHaveBeenCalled()
  })

  it("runs bootstrap once for fresh contexts sharing a projectRoot", async () => {
    let resolveBootstrap!: (result: {
      status: string
      workspace: { available: boolean }
      warnings: Array<string>
      diagnostics: Array<unknown>
    }) => void
    const pending = new Promise<{
      status: string
      workspace: { available: boolean }
      warnings: Array<string>
      diagnostics: Array<unknown>
    }>((resolve) => {
      resolveBootstrap = resolve
    })
    mocks.bootstrapAgentWorkspace.mockReturnValue(pending)

    const { createSessionServices } = await import("../session-factory")
    const contextA = { projectRoot: "/shared-root" } as AppRuntimeContext
    const contextB = { projectRoot: "/shared-root" } as AppRuntimeContext

    const promiseA = createSessionServices(contextA)
    const promiseB = createSessionServices(contextB)

    resolveBootstrap({
      status: "ok",
      workspace: { available: true },
      warnings: [],
      diagnostics: [],
    })

    const [servicesA, servicesB] = await Promise.all([promiseA, promiseB])

    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(1)
    expect(servicesA.workspaceBootstrap?.status).toBe("ok")
    expect(servicesB.workspaceBootstrap?.status).toBe("ok")
  })

  it("honors exponential backoff within the retry window on failure", async () => {
    mocks.bootstrapAgentWorkspace.mockResolvedValue({
      status: "degraded",
      workspace: { available: false },
      warnings: [],
      diagnostics: [],
    })

    const { createSessionServices } = await import("../session-factory")
    const nowTime = 1000000000000
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => nowTime)

    const services1 = await createSessionServices({
      projectRoot: "/backoff-root",
    } as AppRuntimeContext)
    expect(services1.workspaceBootstrap?.status).toBe("degraded")
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(1)

    // A fresh context for the same root, still inside the 1s window, must reuse
    // the cached failure instead of re-running bootstrap.
    const services2 = await createSessionServices({
      projectRoot: "/backoff-root",
    } as AppRuntimeContext)
    expect(services2.workspaceBootstrap?.status).toBe("degraded")
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(1)

    dateSpy.mockRestore()
  })

  it("resets backoff after a successful bootstrap", async () => {
    mocks.bootstrapAgentWorkspace
      .mockResolvedValueOnce({
        status: "degraded",
        workspace: { available: false },
        warnings: [],
        diagnostics: [],
      })
      .mockResolvedValue({
        status: "ok",
        workspace: { available: true },
        warnings: [],
        diagnostics: [],
      })

    const { createSessionServices } = await import("../session-factory")
    let nowTime = 1000000000000
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => nowTime)

    const services1 = await createSessionServices({
      projectRoot: "/reset-root",
    } as AppRuntimeContext)
    expect(services1.workspaceBootstrap?.status).toBe("degraded")

    // Move past the 1s window so the next call retries and succeeds.
    nowTime += 1500
    const services2 = await createSessionServices({
      projectRoot: "/reset-root",
    } as AppRuntimeContext)
    expect(services2.workspaceBootstrap?.status).toBe("ok")
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(2)

    // Success resets attempts/backoff: an immediate follow-up roots in the
    // fresh window and returns the cached success without another bootstrap.
    const services3 = await createSessionServices({
      projectRoot: "/reset-root",
    } as AppRuntimeContext)
    expect(services3.workspaceBootstrap?.status).toBe("ok")
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(2)

    dateSpy.mockRestore()
  })

  it("evicts the least-recently-used projectRoot when the cache cap is exceeded", async () => {
    mocks.bootstrapAgentWorkspace.mockResolvedValue({
      status: "ok",
      workspace: { available: true },
      warnings: [],
      diagnostics: [],
    })

    const { createSessionServices } = await import("../session-factory")

    // Fill the cache to its capacity of 32 project roots.
    for (let index = 0; index < 32; index++) {
      await createSessionServices({
        projectRoot: `/lru-root-${index}`,
      } as AppRuntimeContext)
    }
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(32)

    // Touch lru-root-0 so it becomes the most-recently-used entry.
    await createSessionServices({
      projectRoot: "/lru-root-0",
    } as AppRuntimeContext)
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(32)

    // Inserting a 33rd root evicts the least-recently-used entry (lru-root-1).
    await createSessionServices({
      projectRoot: "/lru-root-32",
    } as AppRuntimeContext)
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(33)

    // The evicted root is re-bootstrapped on its next request.
    await createSessionServices({
      projectRoot: "/lru-root-1",
    } as AppRuntimeContext)
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(34)

    // The refreshed lru-root-0 entry was not evicted: still served from cache.
    await createSessionServices({
      projectRoot: "/lru-root-0",
    } as AppRuntimeContext)
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(34)
  })

  it("re-bootstraps an evicted root instead of serving a stale cached result", async () => {
    mocks.bootstrapAgentWorkspace
      .mockResolvedValueOnce({
        status: "degraded",
        workspace: { available: false },
        warnings: [],
        diagnostics: [],
      })
      .mockResolvedValue({
        status: "ok",
        workspace: { available: true },
        warnings: [],
        diagnostics: [],
      })

    const { createSessionServices } = await import("../session-factory")
    const nowTime = 1000000000000
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => nowTime)

    const first = await createSessionServices({
      projectRoot: "/evicted-root",
    } as AppRuntimeContext)
    expect(first.workspaceBootstrap?.status).toBe("degraded")

    // Insert 32 other roots so /evicted-root falls out of the cache.
    for (let index = 0; index < 32; index++) {
      await createSessionServices({
        projectRoot: `/evict-filler-${index}`,
      } as AppRuntimeContext)
    }
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(33)

    // Still inside the 1s backoff window: a cached root would serve its stale
    // failure. The evicted root must re-run bootstrap and pick up the fresh
    // success instead.
    const second = await createSessionServices({
      projectRoot: "/evicted-root",
    } as AppRuntimeContext)
    expect(second.workspaceBootstrap?.status).toBe("ok")
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(34)

    // Other roots' entries are unaffected by the eviction and re-bootstrap.
    const filler = await createSessionServices({
      projectRoot: "/evict-filler-31",
    } as AppRuntimeContext)
    expect(filler.workspaceBootstrap?.status).toBe("ok")
    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(34)

    dateSpy.mockRestore()
  })

  it("keeps independent caches for distinct projectRoots", async () => {
    mocks.bootstrapAgentWorkspace.mockResolvedValue({
      status: "ok",
      workspace: { available: true },
      warnings: [],
      diagnostics: [],
    })

    const { createSessionServices } = await import("../session-factory")
    await createSessionServices({ projectRoot: "/root-a" } as AppRuntimeContext)
    await createSessionServices({ projectRoot: "/root-b" } as AppRuntimeContext)
    // A repeat call for root-a reuses its cache (no third bootstrap).
    await createSessionServices({ projectRoot: "/root-a" } as AppRuntimeContext)

    expect(mocks.bootstrapAgentWorkspace).toHaveBeenCalledTimes(2)
  })
})
