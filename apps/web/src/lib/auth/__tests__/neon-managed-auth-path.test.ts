import { describe, expect, it } from "vitest"
import { extractAuthProxyPath } from "../neon-managed-auth"

describe("extractAuthProxyPath", () => {
  it("returns empty when URL normalization escapes /api/auth", () => {
    const request = new Request("https://app.example/api/auth/../admin/secret")
    // URL API resolves to /admin/secret before we parse.
    expect(extractAuthProxyPath(request)).toEqual([])
  })

  it("returns auth path segments", () => {
    const request = new Request("https://app.example/api/auth/sign-in/email")
    expect(extractAuthProxyPath(request)).toEqual(["sign-in", "email"])
  })
})
