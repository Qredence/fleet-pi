// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { getChatSessionScope, useChatStorage } from "../use-chat-storage"

function createLocalStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial))

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => {
      entries.delete(key)
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
    clear: () => {
      entries.clear()
    },
    snapshot: () => Object.fromEntries(entries),
  }
}

describe("useChatStorage hook", () => {
  let mockStorage: ReturnType<typeof createLocalStorage>

  beforeEach(() => {
    mockStorage = createLocalStorage()
    vi.stubGlobal("window", {
      localStorage: mockStorage,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("getChatSessionScope", () => {
    it("maps modes to scopes correctly", () => {
      expect(getChatSessionScope("agent")).toBe("normal")
      expect(getChatSessionScope("plan")).toBe("normal")
      expect(getChatSessionScope("harness")).toBe("harness")
    })
  })

  describe("initialization and hydration", () => {
    it("initializes and hydrates stored mode after mount", () => {
      mockStorage.setItem("fleet-pi-chat-mode", "harness")

      const { result } = renderHook(() => useChatStorage())

      // After mount / hydration effect runs, it updates to "harness"
      expect(result.current.mode).toBe("harness")
    })

    it("hydrates scoped sessions and clears invalid fields", () => {
      mockStorage.setItem(
        "fleet-pi-chat-sessions",
        JSON.stringify({
          normal: {
            sessionId: "normal-session",
            sessionFile: "/repo/session.jsonl",
          },
          harness: { sessionId: 123, sessionFile: "/repo/harness.jsonl" }, // Invalid sessionId (number)
        })
      )

      const { result } = renderHook(() => useChatStorage())

      // Under default "agent" mode, sessionMetadata is "normal-session"
      expect(result.current.sessionMetadata).toEqual({
        sessionId: "normal-session",
        sessionFile: "/repo/session.jsonl",
      })

      // Switch to "harness" mode
      act(() => {
        result.current.setMode("harness")
      })

      // In harness mode, the invalid sessionId is cleared/ignored
      expect(result.current.sessionMetadata).toEqual({})
    })

    it("falls back to legacy storage when scoped storage is absent", () => {
      mockStorage.setItem(
        "fleet-pi-chat-session",
        JSON.stringify({
          sessionId: "legacy-session",
          sessionFile: "/repo/legacy.jsonl",
        })
      )

      const { result } = renderHook(() => useChatStorage())

      expect(result.current.sessionMetadata).toEqual({
        sessionId: "legacy-session",
        sessionFile: "/repo/legacy.jsonl",
      })
    })

    it("handles corrupt session and mode JSON safely", () => {
      mockStorage.setItem("fleet-pi-chat-sessions", "invalid-json")
      mockStorage.setItem("fleet-pi-chat-mode", "invalid-mode")

      const { result } = renderHook(() => useChatStorage())

      expect(result.current.mode).toBe("agent")
      expect(result.current.sessionMetadata).toEqual({})
    })

    it("handles legacy double-quoted mode values", () => {
      mockStorage.setItem("fleet-pi-chat-mode", '"plan"')

      const { result } = renderHook(() => useChatStorage())

      expect(result.current.mode).toBe("plan")
    })
  })

  describe("persistence and session updates", () => {
    it("persists active mode and clears legacy keys upon change", () => {
      mockStorage.setItem("fleet-pi-chat-mode", "agent")

      const { result } = renderHook(() => useChatStorage())

      act(() => {
        result.current.setMode("plan")
      })

      expect(mockStorage.snapshot()["fleet-pi-chat-mode"]).toBe("plan")
    })

    it("persists active session metadata and removes legacy key", () => {
      const { result } = renderHook(() => useChatStorage())

      act(() => {
        result.current.setSessionMetadata({
          sessionId: "new-session",
          sessionFile: "/repo/new.jsonl",
        })
      })

      expect(result.current.sessionMetadata).toEqual({
        sessionId: "new-session",
        sessionFile: "/repo/new.jsonl",
      })

      const sessions = JSON.parse(
        mockStorage.snapshot()["fleet-pi-chat-sessions"]
      )
      expect(sessions.normal).toEqual({
        sessionId: "new-session",
        sessionFile: "/repo/new.jsonl",
      })
      expect(mockStorage.snapshot()["fleet-pi-chat-session"]).toBeUndefined()
    })

    it("clears local storage key when all sessions are empty", () => {
      mockStorage.setItem(
        "fleet-pi-chat-sessions",
        JSON.stringify({
          normal: { sessionId: "normal-session" },
          harness: {},
        })
      )

      const { result } = renderHook(() => useChatStorage())

      act(() => {
        result.current.setSessionMetadata({})
      })

      expect(mockStorage.snapshot()["fleet-pi-chat-sessions"]).toBeUndefined()
    })
  })

  describe("Restricted browser environment safety", () => {
    it("returns safe defaults and does not crash when localStorage is missing", () => {
      vi.stubGlobal("window", {})

      const { result } = renderHook(() => useChatStorage())

      expect(result.current.mode).toBe("agent")
      expect(result.current.sessionMetadata).toEqual({})

      expect(() => {
        act(() => {
          result.current.setMode("harness")
        })
      }).not.toThrow()

      expect(() => {
        act(() => {
          result.current.setSessionMetadata({ sessionId: "no-crash" })
        })
      }).not.toThrow()
    })
  })
})
