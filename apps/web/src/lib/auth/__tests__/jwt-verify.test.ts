import { describe, expect, it, vi } from "vitest"

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}))

describe("verifyNeonAuthAccessToken", () => {
  it("fails closed when Neon Managed Auth is configured without issuer", async () => {
    const { jwtVerify } = await import("jose")
    const { verifyNeonAuthAccessToken } = await import("../jwt-verify")

    await expect(
      verifyNeonAuthAccessToken("token", {
        NEON_AUTH_BASE_URL: "https://auth.example",
        NEON_AUTH_JWKS_URL: "https://auth.example/.well-known/jwks.json",
      })
    ).resolves.toBeNull()

    expect(jwtVerify).not.toHaveBeenCalled()
  })
})
