import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getNeonManagedSessionFromRequest } from "../neon-managed-auth"

const originalFetch = globalThis.fetch
const originalBaseUrl = process.env.NEON_AUTH_BASE_URL
const originalCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET

describe("getNeonManagedSessionFromRequest", () => {
  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = "https://auth.example/neondb/auth"
    process.env.NEON_AUTH_COOKIE_SECRET =
      "test-cookie-secret-at-least-32-chars!!"
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalBaseUrl === undefined) {
      delete process.env.NEON_AUTH_BASE_URL
    } else {
      process.env.NEON_AUTH_BASE_URL = originalBaseUrl
    }
    if (originalCookieSecret === undefined) {
      delete process.env.NEON_AUTH_COOKIE_SECRET
    } else {
      process.env.NEON_AUTH_COOKIE_SECRET = originalCookieSecret
    }
  })

  it("returns null when Neon Auth responds 200 with a null JSON body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )

    const session = await getNeonManagedSessionFromRequest(
      new Request("http://localhost:3000/api/auth/get-session")
    )

    expect(session).toBeNull()
  })

  it("returns the session payload when user id is present", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: "user-1", email: "a@example.com", name: "A" },
          session: { id: "sess-1", userId: "user-1" },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    )

    const session = await getNeonManagedSessionFromRequest(
      new Request("http://localhost:3000/api/auth/get-session")
    )

    expect(session?.user?.id).toBe("user-1")
  })
})
