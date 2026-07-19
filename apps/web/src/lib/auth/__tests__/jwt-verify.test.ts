import { describe, expect, it, vi } from "vitest"

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}))

describe("verifyNeonAuthAccessToken", () => {
  it("fails closed when Managed Auth is on but issuer cannot be resolved", async () => {
    const { jwtVerify } = await import("jose")
    const { verifyNeonAuthAccessToken } = await import("../jwt-verify")

    await expect(
      verifyNeonAuthAccessToken("token", {
        // Truthy Managed Auth signal that cannot yield a URL origin.
        NEON_AUTH_BASE_URL: "not-a-valid-url",
        NEON_AUTH_JWKS_URL: "https://auth.example/.well-known/jwks.json",
      })
    ).resolves.toBeNull()

    expect(jwtVerify).not.toHaveBeenCalled()
  })

  it("derives issuer from NEON_AUTH_BASE_URL origin when NEON_AUTH_ISSUER is unset", async () => {
    const { jwtVerify } = await import("jose")
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: "user-1", email: "a@b.co" },
      protectedHeader: { alg: "EdDSA" },
      key: {} as never,
    })

    const { verifyNeonAuthAccessToken } = await import("../jwt-verify")

    await expect(
      verifyNeonAuthAccessToken("token", {
        NEON_AUTH_BASE_URL: "https://auth.example/neondb/auth",
        NEON_AUTH_JWKS_URL: "https://auth.example/.well-known/jwks.json",
      })
    ).resolves.toEqual({ sub: "user-1", email: "a@b.co" })

    expect(jwtVerify).toHaveBeenCalledWith(
      "token",
      expect.anything(),
      expect.objectContaining({ issuer: "https://auth.example" })
    )
  })
})
