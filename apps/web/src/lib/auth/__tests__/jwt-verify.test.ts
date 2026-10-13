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

  it.each([
    {
      surface: "worker",
      env: {
        FLEET_PI_DEPLOYMENT: "cloudflare",
        NEON_AUTH_BASE_URL: "https://auth.example/neondb/auth",
        NEON_AUTH_JWKS_URL: "https://auth.example/.well-known/jwks.json",
      },
    },
    {
      surface: "function",
      env: {
        NEON_AUTH_URL: "https://auth.example/neondb/auth",
        NEON_AUTH_JWKS_URL: "https://auth.example/.well-known/jwks.json",
      },
    },
  ])(
    "rejects a token on the $surface when NEON_AUTH_ISSUER is unset",
    async ({ env }) => {
      const { jwtVerify } = await import("jose")
      const { verifyNeonAuthAccessToken } = await import("../jwt-verify")

      await expect(verifyNeonAuthAccessToken("token", env)).resolves.toBeNull()
      expect(jwtVerify).not.toHaveBeenCalled()
    }
  )
})
