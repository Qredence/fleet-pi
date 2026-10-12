import { describe, expect, it } from "vitest"
import {
  explicitEnabledModelIds,
  modelIdsForRegistration,
} from "../explicit-enabled-model-ids"

describe("explicitEnabledModelIds", () => {
  it("keeps slash model ids and drops globs and other providers", () => {
    expect(
      explicitEnabledModelIds(
        [
          "custom+command-code/deepseek/deepseek-v4-flash",
          "custom+command-code/*",
          "custom+command-code/moonshotai/Kimi-K2.6:high",
          "google/gemini-2.5-flash",
        ],
        "custom+command-code"
      )
    ).toEqual(["deepseek/deepseek-v4-flash", "moonshotai/Kimi-K2.6"])
  })
})

describe("modelIdsForRegistration", () => {
  it("puts stored ids first and appends enabled ids", () => {
    expect(
      modelIdsForRegistration(
        ["deepseek/deepseek-v4-flash"],
        [
          "custom+command-code/gpt-5.5",
          "custom+command-code/deepseek/deepseek-v4-flash",
        ],
        "custom+command-code"
      )
    ).toEqual(["deepseek/deepseek-v4-flash", "gpt-5.5"])
  })
})
