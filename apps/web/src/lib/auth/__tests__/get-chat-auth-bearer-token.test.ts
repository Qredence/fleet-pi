import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const resolveClientNeonAuthUrl = vi.fn(() => "")
const isNeonManagedAuthClientEnabled = vi.fn(() => false)

vi.mock("@/lib/auth/auth-mode", () => ({
  resolveClientNeonAuthUrl: () => resolveClientNeonAuthUrl(),
  isNeonManagedAuthClientEnabled: () => isNeonManagedAuthClientEnabled(),
  resolveNeonAuthBaseUrl: () => "",
  isNeonManagedAuthConfigured: () => false,
  resolveAuthBackend: () => "local-better-auth",
  resolveNeonAuthCookieSecret: () => "",
  isLocalAnonymousAuthAllowed: () => true,
}))

vi.mock("@neondatabase/auth", () => ({
  createAuthClient: vi.fn(() => ({})),
}))

vi.mock("@neondatabase/auth/react/adapters", () => ({
  BetterAuthReactAdapter: vi.fn(() => () => ({})),
}))

vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({
    useSession: vi.fn(),
    signIn: {},
    signUp: {},
    signOut: vi.fn(),
  })),
}))

describe("getChatAuthBearerToken", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    resolveClientNeonAuthUrl.mockReturnValue("")
    isNeonManagedAuthClientEnabled.mockReturnValue(false)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("returns null when Neon Managed Auth is disabled", async () => {
    const { getChatAuthBearerToken } = await import("../client")
    await expect(getChatAuthBearerToken()).resolves.toBeNull()
    expect(globalThis.fetch).toBe(originalFetch)
  })

  it("fetches JWT from Neon Auth /token and never proxies getJWTToken", async () => {
    isNeonManagedAuthClientEnabled.mockReturnValue(true)
    resolveClientNeonAuthUrl.mockReturnValue(
      "https://ep-example.neonauth.aws.neon.tech/neondb/auth/"
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "eyJ.test.jwt" }),
    })
    globalThis.fetch = fetchMock

    const { getChatAuthBearerToken } = await import("../client")
    await expect(getChatAuthBearerToken()).resolves.toBe("eyJ.test.jwt")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ep-example.neonauth.aws.neon.tech/neondb/auth/token",
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      })
    )
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain(
      "get-j-w-t-token"
    )
  })

  it("returns null on Neon /token failure instead of throwing", async () => {
    isNeonManagedAuthClientEnabled.mockReturnValue(true)
    resolveClientNeonAuthUrl.mockReturnValue(
      "https://ep-example.neonauth.aws.neon.tech/neondb/auth"
    )
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    })

    const { getChatAuthBearerToken } = await import("../client")
    await expect(getChatAuthBearerToken()).resolves.toBeNull()
  })
})
