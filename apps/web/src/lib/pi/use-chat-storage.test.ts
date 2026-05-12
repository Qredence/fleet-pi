import { describe, expect, it } from "vitest"
import { getChatSessionScope } from "./use-chat-storage"

describe("chat storage", () => {
  it("keeps Agent and Plan in the normal session scope", () => {
    expect(getChatSessionScope("agent")).toBe("normal")
    expect(getChatSessionScope("plan")).toBe("normal")
  })

  it("keeps Harness in a separate session scope", () => {
    expect(getChatSessionScope("harness")).toBe("harness")
  })
})
