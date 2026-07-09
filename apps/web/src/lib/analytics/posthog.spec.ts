import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  captureChatSessionStarted,
  captureConversationSaved,
  identifyAnalyticsUser,
  isAnalyticsEnabled,
  resetAnalytics,
} from "./posthog"

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
}))

vi.mock("posthog-js", () => ({ default: posthogMock }))

describe("posthog analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("stays disabled and never captures when no key is configured", () => {
    // No VITE_PUBLIC_POSTHOG_KEY is set in the test env, so analytics is off.
    expect(isAnalyticsEnabled()).toBe(false)

    captureChatSessionStarted({ promptLength: 12, sessionId: "s1" })
    captureConversationSaved({ messageCount: 4, sessionId: "s1" })
    identifyAnalyticsUser({ id: "u1", email: "a@b.co" })
    resetAnalytics()

    expect(posthogMock.capture).not.toHaveBeenCalled()
    expect(posthogMock.identify).not.toHaveBeenCalled()
    expect(posthogMock.reset).not.toHaveBeenCalled()
  })

  it("capture helpers are safe no-ops that do not throw", () => {
    expect(() =>
      captureChatSessionStarted({ promptLength: 0 })
    ).not.toThrow()
    expect(() =>
      captureConversationSaved({ messageCount: 0 })
    ).not.toThrow()
  })
})
