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

function makeJwt(expSecondsFromNow: number) {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }))
  const payload = btoa(
    JSON.stringify({
      sub: "user-1",
      exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    })
  )
  return `${header}.${payload}.sig`
}

describe("getChatAuthBearerToken", () => {
  beforeEach(() => {
    resolveClientNeonAuthUrl.mockReturnValue("")
    isNeonManagedAuthClientEnabled.mockReturnValue(false)
    token.mockReset()
    betterAuthReactAdapterFactory.mockClear()
    adapterOptionsSeen.current = undefined
  })

  afterEach(async () => {
    const { clearChatAuthBearerTokenCache } = await import("../client")
    clearChatAuthBearerTokenCache()
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
      "https://fleet-pi-web.vercel.app/api/auth"
    )
    token.mockResolvedValue({ data: { token: makeJwt(600) }, error: null })

    const { getChatAuthBearerToken } = await import("../client")
    const minted = await getChatAuthBearerToken()
    expect(minted).toMatch(/^ey/)

    expect(token).toHaveBeenCalledTimes(1)
    expect(adapterOptionsSeen.current?.fetchOptions).toEqual({
      credentials: "include",
    })
  })

  it("coalesces concurrent mint calls and caches the bearer", async () => {
    isNeonManagedAuthClientEnabled.mockReturnValue(true)
    resolveClientNeonAuthUrl.mockReturnValue(
      "https://fleet-pi-web.vercel.app/api/auth"
    )
    let resolveToken:
      ((value: { data: { token: string }; error: null }) => void) | undefined
    token.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve
        })
    )

    const { getChatAuthBearerToken } = await import("../client")
    const first = getChatAuthBearerToken()
    const second = getChatAuthBearerToken()
    expect(token).toHaveBeenCalledTimes(1)

    resolveToken?.({ data: { token: makeJwt(600) }, error: null })
    const [a, b] = await Promise.all([first, second])
    expect(a).toBe(b)
    expect(token).toHaveBeenCalledTimes(1)

    await expect(getChatAuthBearerToken()).resolves.toBe(a)
    expect(token).toHaveBeenCalledTimes(1)
  })

  it("retries once when the first mint fails", async () => {
    isNeonManagedAuthClientEnabled.mockReturnValue(true)
    resolveClientNeonAuthUrl.mockReturnValue(
      "https://fleet-pi-web.vercel.app/api/auth"
    )
    token
      .mockResolvedValueOnce({
        data: null,
        error: { message: "unauthorized" },
      })
      .mockResolvedValueOnce({ data: { token: makeJwt(600) }, error: null })

    const { getChatAuthBearerToken } = await import("../client")
    await expect(getChatAuthBearerToken()).resolves.toMatch(/^ey/)
    expect(token).toHaveBeenCalledTimes(2)
  })

  it("returns null on authClient.token() failure instead of throwing", async () => {
    isNeonManagedAuthClientEnabled.mockReturnValue(true)
    resolveClientNeonAuthUrl.mockReturnValue(
      "https://fleet-pi-web.vercel.app/api/auth"
    )
    token.mockResolvedValue({
      data: null,
      error: { message: "unauthorized" },
    })

    const { getChatAuthBearerToken } = await import("../client")
    await expect(getChatAuthBearerToken()).resolves.toBeNull()
  })
})
