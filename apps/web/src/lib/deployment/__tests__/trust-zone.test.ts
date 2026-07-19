import { describe, expect, it } from "vitest"
import { runWithChatAuthSurface } from "../../auth/chat-auth-surface"
import {
  requiresAuthenticatedMirrorOwner,
  shouldFailClosedOnMirrorError,
} from "../trust-zone"

describe("shouldFailClosedOnMirrorError", () => {
  it("fails open locally without Neon Auth", () => {
    expect(shouldFailClosedOnMirrorError({})).toBe(false)
    expect(requiresAuthenticatedMirrorOwner({})).toBe(false)
  })

  it("fails closed on Vercel", () => {
    expect(shouldFailClosedOnMirrorError({ VERCEL: "1" })).toBe(true)
  })

  it("fails closed when Neon Managed Auth is configured", () => {
    expect(
      shouldFailClosedOnMirrorError({
        NEON_AUTH_BASE_URL: "https://auth.example",
      })
    ).toBe(true)
  })

  it("fails closed on neon-function chat auth surface", () => {
    runWithChatAuthSurface("neon-function", () => {
      expect(shouldFailClosedOnMirrorError({})).toBe(true)
      expect(requiresAuthenticatedMirrorOwner({})).toBe(true)
    })
  })
})
