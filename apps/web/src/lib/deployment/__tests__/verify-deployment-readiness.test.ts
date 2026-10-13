import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("dotenv", () => ({ default: { config: vi.fn() } }))
vi.mock("@neondatabase/serverless", () => ({
  Pool: class {
    query = vi.fn().mockResolvedValue({ rows: [] })
    end = vi.fn().mockResolvedValue(undefined)
  },
}))
vi.mock("../readiness", () => ({
  validateDeploymentReadiness: vi
    .fn()
    .mockReturnValue({ ok: true, checks: [] }),
}))

const originalExitCode = process.exitCode

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("FLEET_PI_DEPLOYMENT_TRUST_ZONE", "local")
  vi.stubEnv("FLEET_PI_CHAT_DATABASE_URL", "")
  vi.stubEnv("FLEET_PI_CHAT_MIGRATION_DATABASE_URL", "")
  vi.stubEnv("FLEET_PI_AUTH_MIGRATION_DATABASE_URL", "")
  process.exitCode = undefined
  vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  process.exitCode = originalExitCode
})

describe("required migration probes in deployment readiness CLI", () => {
  it.each([
    { chat: "", auth: "", missing: "CHAT" },
    { chat: "", auth: "postgres://test/auth", missing: "CHAT" },
    { chat: "postgres://test/chat", auth: "", missing: "AUTH" },
  ])(
    "fails with chat='$chat' and auth='$auth'",
    async ({ chat, auth, missing }) => {
      vi.stubEnv("FLEET_PI_READINESS_REQUIRE_MIGRATION_PROBES", "1")
      vi.stubEnv("FLEET_PI_CHAT_MIGRATION_DATABASE_URL", chat)
      vi.stubEnv("FLEET_PI_AUTH_MIGRATION_DATABASE_URL", auth)

      await import("../../../../scripts/verify-deployment-readiness")

      await vi.waitFor(() => {
        expect(process.exitCode).toBe(1)
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining(
            `FAIL migration-db: Set FLEET_PI_${missing}_MIGRATION_DATABASE_URL`
          )
        )
      })
    }
  )

  it("passes when both required migration URLs are set", async () => {
    vi.stubEnv("FLEET_PI_READINESS_REQUIRE_MIGRATION_PROBES", "1")
    vi.stubEnv("FLEET_PI_CHAT_MIGRATION_DATABASE_URL", "postgres://test/chat")
    vi.stubEnv("FLEET_PI_AUTH_MIGRATION_DATABASE_URL", "postgres://test/auth")

    await import("../../../../scripts/verify-deployment-readiness")

    await vi.waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("INFO migrations:")
      )
    })
    expect(process.exitCode).toBeUndefined()
  })

  it("warns for both missing URLs when migration probes are optional", async () => {
    vi.stubEnv("FLEET_PI_READINESS_REQUIRE_MIGRATION_PROBES", "0")

    await import("../../../../scripts/verify-deployment-readiness")

    await vi.waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("INFO migrations:")
      )
    })
    for (const kind of ["CHAT", "AUTH"]) {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          `WARN migration-db: Set FLEET_PI_${kind}_MIGRATION_DATABASE_URL`
        )
      )
    }
    expect(process.exitCode).toBeUndefined()
  })
})
