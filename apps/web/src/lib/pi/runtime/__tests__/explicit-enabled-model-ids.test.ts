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
  it.each([
    "gpt-5.5",
    "openai-chat-completions/gpt-*",
    "openai-chat-completions/gpt-5.?",
    "OPENAI-CHAT-COMPLETIONS/GPT-5.5:high",
    "gpt-*:medium",
  ])("matches configured OCC models using %s", (pattern) => {
    expect(
      modelIdsForRegistration(
        ["gpt-5.5", "other"],
        [pattern],
        "openai-chat-completions"
      )
    ).toEqual(["gpt-5.5"])
  })

  it("matches named OCC models without growing past stored ids", () => {
    expect(
      modelIdsForRegistration(
        ["org/model-a"],
        ["org/*", "openai-chat-completions+named/org/model-b"],
        "openai-chat-completions+named"
      )
    ).toEqual(["org/model-a"])
  })

  it("combines matching stored custom ids with explicit additions", () => {
    expect(
      modelIdsForRegistration(
        ["org/model-a", "other", " org/model-a "],
        [
          "org/model-?",
          "CUSTOM+TEST/org/model-b:high",
          "custom+test/org/model-b",
        ],
        "custom+test"
      )
    ).toEqual(["org/model-a", "org/model-b"])
  })

  it("applies the registration cap after filtering matching stored models", () => {
    expect(
      modelIdsForRegistration(
        ["excluded", "gpt-a", "gpt-b", "gpt-c"],
        ["gpt-*", "custom+test/new"],
        "custom+test",
        2
      )
    ).toEqual(["gpt-a", "gpt-b"])
  })

  it("keeps allow-all semantics without registering glob ids", () => {
    expect(
      modelIdsForRegistration(
        ["stored"],
        ["/*", "custom+test/*", "custom+test/new"],
        "custom+test"
      )
    ).toEqual(["stored", "new"])
    expect(modelIdsForRegistration(["stored"], ["*"], "custom+test")).toEqual([
      "stored",
    ])
  })

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
