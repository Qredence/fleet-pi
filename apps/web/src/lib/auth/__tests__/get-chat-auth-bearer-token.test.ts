import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const resolveClientNeonAuthUrl = vi.fn(() => "")
const isNeonManagedAuthClientEnabled = vi.fn(() => false)
const token = vi.fn()

type AdapterOptions = {
  fetchOptions?: { credentials?: RequestCredentials }
}

const adapterOptionsSeen: { current?: AdapterOptions } = {}

const betterAuthReactAdapterFactory = vi.fn((options?: AdapterOptions) => {
  adapterOptionsSeen.current = options
  return () => ({})
})

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
  createAuthClient: vi.fn(() => ({
    token,
  })),
}))

vi.mock("@neondatabase/auth/react/adapters", () => ({
  BetterAuthReactAdapter: (options?: AdapterOptions) =>
    betterAuthReactAdapterFactory(options),
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
  beforeEach(() => {
    resolveClientNeonAuthUrl.mockReturnValue("")
    isNeonManagedAuthClientEnabled.mockReturnValue(false)
    token.mockReset()
    betterAuthReactAdapterFactory.mockClear()
    adapterOptionsSeen.current = undefined
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("returns null when Neon Managed Auth is disabled", async () => {
    const { getChatAuthBearerToken } = await import("../client")
    await expect(getChatAuthBearerToken()).resolves.toBeNull()
    expect(token).not.toHaveBeenCalled()
  })

  it("mints JWT via authClient.token() with credentials include", async () => {
    isNeonManagedAuthClientEnabled.mockReturnValue(true)
    resolveClientNeonAuthUrl.mockReturnValue(
      "https://ep-example.neonauth.aws.neon.tech/neondb/auth/"
    )
    token.mockResolvedValue({ data: { token: "eyJ.test.jwt" }, error: null })

    const { getChatAuthBearerToken } = await import("../client")
    await expect(getChatAuthBearerToken()).resolves.toBe("eyJ.test.jwt")

    expect(token).toHaveBeenCalledTimes(1)
    expect(adapterOptionsSeen.current?.fetchOptions).toEqual({
      credentials: "include",
    })
  })

  it("returns null on authClient.token() failure instead of throwing", async () => {
    isNeonManagedAuthClientEnabled.mockReturnValue(true)
    resolveClientNeonAuthUrl.mockReturnValue(
      "https://ep-example.neonauth.aws.neon.tech/neondb/auth"
    )
    token.mockResolvedValue({
      data: null,
      error: { message: "unauthorized" },
    })

    const { getChatAuthBearerToken } = await import("../client")
    await expect(getChatAuthBearerToken()).resolves.toBeNull()
  })
})
