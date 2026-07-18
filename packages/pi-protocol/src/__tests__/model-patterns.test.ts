import { describe, expect, it } from "vitest"
import { isModelPatternEnabled } from "../model-patterns"

const googleFlash = {
  id: "gemini-3.5-flash",
  provider: "google",
  modelId: "gemini-3.5-flash",
  key: "google/gemini-3.5-flash",
}

describe("isModelPatternEnabled", () => {
  it("treats undefined patterns as allow-all", () => {
    expect(isModelPatternEnabled(googleFlash, undefined)).toBe(true)
  })

  it("treats empty patterns as deny-all", () => {
    expect(isModelPatternEnabled(googleFlash, [])).toBe(false)
  })

  it("matches explicit provider/model patterns", () => {
    expect(
      isModelPatternEnabled(googleFlash, ["google/gemini-3.5-flash"])
    ).toBe(true)
    expect(isModelPatternEnabled(googleFlash, ["openai/gpt-4o"])).toBe(false)
  })
})
