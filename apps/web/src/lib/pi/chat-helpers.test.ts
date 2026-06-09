import { describe, expect, it } from "vitest"
import { normalizeSessionLabel } from "@workspace/hax-design/lib/pi/chat-helpers"

describe("chat helpers", () => {
  describe("normalizeSessionLabel", () => {
    it("returns empty labels unchanged", () => {
      expect(normalizeSessionLabel("")).toBe("")
      expect(normalizeSessionLabel("   ")).toBe("")
    })

    it("collapses exact half-string duplication", () => {
      expect(normalizeSessionLabel("abcabc")).toBe("abc")
    })

    it("does not collapse odd-length palindromes", () => {
      expect(normalizeSessionLabel("abcba")).toBe("abcba")
    })

    it("returns non-duplicated values unchanged", () => {
      expect(normalizeSessionLabel("fleet pi")).toBe("fleet pi")
    })
  })
})
