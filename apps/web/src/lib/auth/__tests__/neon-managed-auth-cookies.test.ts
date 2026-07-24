import { describe, expect, it } from "vitest"
import { rewriteNeonAuthSetCookieForAppHost } from "../neon-managed-auth"

describe("rewriteNeonAuthSetCookieForAppHost", () => {
  it("strips Domain and Partitioned for first-party app cookies", () => {
    const rewritten = rewriteNeonAuthSetCookieForAppHost(
      "__Secure-neon-auth.session_token=abc; Path=/; Domain=ep-example.neonauth.aws.neon.tech; Secure; HttpOnly; SameSite=None; Partitioned"
    )

    expect(rewritten).toContain("__Secure-neon-auth.session_token=abc")
    expect(rewritten).toContain("Path=/")
    expect(rewritten).toContain("SameSite=Lax")
    expect(rewritten).toContain("Secure")
    expect(rewritten).toContain("HttpOnly")
    expect(rewritten).not.toMatch(/Domain=/i)
    expect(rewritten).not.toMatch(/Partitioned/i)
    expect(rewritten).not.toMatch(/SameSite=None/i)
  })

  it("adds Path and SameSite when missing", () => {
    const rewritten = rewriteNeonAuthSetCookieForAppHost(
      "__Secure-neon-auth.session_token=abc; Secure; HttpOnly"
    )

    expect(rewritten).toContain("Path=/")
    expect(rewritten).toContain("SameSite=Lax")
  })
})
