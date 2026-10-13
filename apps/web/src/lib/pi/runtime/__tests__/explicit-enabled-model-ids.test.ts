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
  it("registers only the ids a custom provider user enabled", () => {
    expect(
      modelIdsForRegistration(
        ["deepseek/deepseek-v4-flash"],
        ["custom+command-code/gpt-5.5"],
        "custom+command-code"
      )
    ).toEqual(["gpt-5.5"])
  })

  it("keeps stored ids when the user has not curated a list", () => {
    expect(
      modelIdsForRegistration(
        ["deepseek/deepseek-v4-flash"],
        undefined,
        "custom+command-code"
      )
    ).toEqual(["deepseek/deepseek-v4-flash"])
  })

  it("registers nothing for deny-all", () => {
    expect(
      modelIdsForRegistration(
        ["deepseek/deepseek-v4-flash"],
        [],
        "custom+command-code"
      )
    ).toEqual([])
  })

  it("keeps stored ids when a provider wildcard is enabled", () => {
    expect(
      modelIdsForRegistration(
        ["deepseek/deepseek-v4-flash"],
        ["custom+command-code/*", "custom+command-code/gpt-5.5"],
        "custom+command-code"
      )
    ).toEqual(["deepseek/deepseek-v4-flash", "gpt-5.5"])
  })

  it("does not add enabled ids beyond a configured OCC model", () => {
    expect(
      modelIdsForRegistration(
        ["qwen35-122b-a10b"],
        [
          "openai-chat-completions/gpt-5.5",
          "openai-chat-completions/qwen35-122b-a10b",
        ],
        "openai-chat-completions"
      )
    ).toEqual(["qwen35-122b-a10b"])
  })
})
