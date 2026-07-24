import { afterEach, describe, expect, it } from "vitest"
import { resolveClientNeonAuthUrl } from "../auth-mode"

describe("resolveClientNeonAuthUrl", () => {
  const previousVite = import.meta.env.VITE_NEON_AUTH_URL
  const previousBetterAuth = process.env.BETTER_AUTH_URL
  const previousVercelUrl = process.env.VERCEL_URL
  const previousAppOrigin = import.meta.env.VITE_APP_ORIGIN

  afterEach(() => {
    import.meta.env.VITE_NEON_AUTH_URL = previousVite
    import.meta.env.VITE_APP_ORIGIN = previousAppOrigin
    restoreEnv("BETTER_AUTH_URL", previousBetterAuth)
    restoreEnv("VERCEL_URL", previousVercelUrl)
  })

  it("returns absolute same-origin proxy URL when app origin is known", () => {
    import.meta.env.VITE_NEON_AUTH_URL =
      "https://ep-example.neonauth.aws.neon.tech/neondb/auth"
    process.env.BETTER_AUTH_URL = "https://fleet-pi-web.vercel.app"

    expect(resolveClientNeonAuthUrl()).toBe(
      "https://fleet-pi-web.vercel.app/api/auth"
    )
  })

  it("falls back to upstream Neon Auth URL when no app origin is available", () => {
    import.meta.env.VITE_NEON_AUTH_URL =
      "https://ep-example.neonauth.aws.neon.tech/neondb/auth"
    delete process.env.BETTER_AUTH_URL
    delete process.env.VERCEL_URL
    import.meta.env.VITE_APP_ORIGIN = ""

    expect(resolveClientNeonAuthUrl()).toBe(
      "https://ep-example.neonauth.aws.neon.tech/neondb/auth"
    )
  })

  it("returns empty when Neon Managed Auth is not enabled for the client", () => {
    import.meta.env.VITE_NEON_AUTH_URL = ""

    expect(resolveClientNeonAuthUrl()).toBe("")
  })
})

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}
