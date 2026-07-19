import { describe, expect, it } from "vitest"
import { issueCsrfToken, validateCsrfRequest } from "./csrf"

describe("CSRF protection", () => {
  it("issues and validates a same-origin token", () => {
    const initial = new Request("https://fleet-pi.test/api/sandbox/settings", {
      headers: { Origin: "https://fleet-pi.test" },
    })
    const issued = issueCsrfToken(initial)
    const cookie = issued.cookie.split(";")[0]
    const request = new Request(initial.url, {
      method: "POST",
      headers: {
        Origin: "https://fleet-pi.test",
        Cookie: cookie,
        "X-Fleet-CSRF-Token": issued.token,
      },
    })

    expect(validateCsrfRequest(request)).toEqual({ ok: true })
  })

  it("rejects cross-origin and tokenless requests", () => {
    const crossOrigin = new Request(
      "https://fleet-pi.test/api/sandbox/settings",
      {
        method: "POST",
        headers: { Origin: "https://attacker.test" },
      }
    )
    expect(validateCsrfRequest(crossOrigin).ok).toBe(false)

    const tokenless = new Request(
      "https://fleet-pi.test/api/sandbox/settings",
      {
        method: "POST",
        headers: { Origin: "https://fleet-pi.test" },
      }
    )
    expect(validateCsrfRequest(tokenless).ok).toBe(false)
  })
})
