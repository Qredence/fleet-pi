import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createAgentSessionServices.mockResolvedValue({
      authStorage: { setRuntimeApiKey: vi.fn() },
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
    vi.resetModules()
  })

  it("injects BYOK runtime keys for Vercel users", async () => {
    process.env.VERCEL = "1"
    process.env.BETTER_AUTH_SECRET = "auth-secret"
    const { applyRuntimeAuth } = await import("../session-factory")
    const removeRuntimeApiKey = vi.fn()
    const services = {
      authStorage: {
        setRuntimeApiKey: vi.fn(),
        removeRuntimeApiKey,
      },
    }

    await applyRuntimeAuth(services as never, { userId: "user-1" })

    expect(mocks.withChatPostgresTransaction).toHaveBeenCalled()
    expect(services.authStorage.setRuntimeApiKey).toHaveBeenCalledWith(
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
      authStorage: {
        setRuntimeApiKey,
        removeRuntimeApiKey,
      },
    }

    await applyRuntimeAuth(services as never, {})

    expect(mocks.withChatPostgresTransaction).not.toHaveBeenCalled()
    expect(setRuntimeApiKey).toHaveBeenCalledWith("google", "local-gemini-key")
    expect(removeRuntimeApiKey).toHaveBeenCalled()
  })

  it("scrubs only LLM provider env vars on Vercel", async () => {
    process.env.VERCEL = "1"
    process.env.GEMINI_API_KEY = "secret"
    process.env.DAYTONA_API_KEY = "daytona-secret"
    const { createSessionServices } = await import("../session-factory")

    await createSessionServices({ projectRoot: "/repo" } as AppRuntimeContext)

    expect(process.env.GEMINI_API_KEY).toBeUndefined()
    expect(process.env.DAYTONA_API_KEY).toBe("daytona-secret")
    expect(mocks.createAgentSessionServices).toHaveBeenCalled()
  })
})
