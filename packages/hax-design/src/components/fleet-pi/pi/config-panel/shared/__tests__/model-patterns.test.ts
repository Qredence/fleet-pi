import { describe, expect, it } from "vitest"
import { nextEnabledModelPatterns } from "../model-patterns"
import type { ConfigModelInfo } from "../types"

const googleFlash: ConfigModelInfo = {
  id: "google/gemini-3.5-flash",
  name: "Gemini 3.5 Flash",
  provider: "google",
  modelId: "gemini-3.5-flash",
}

const googlePro: ConfigModelInfo = {
  id: "google/gemini-3.1-pro-preview",
  name: "Gemini 3.1 Pro",
  provider: "google",
  modelId: "gemini-3.1-pro-preview",
}

const openAiModel: ConfigModelInfo = {
  id: "openai/gpt-4o",
  name: "GPT-4o",
  provider: "openai",
  modelId: "gpt-4o",
}

const catalog = [googleFlash, googlePro, openAiModel]

describe("nextEnabledModelPatterns", () => {
  it("removes a model from allow-all without collapsing back to undefined", () => {
    expect(
      nextEnabledModelPatterns({
        currentPatterns: undefined,
        enabled: false,
        model: googleFlash,
        models: catalog,
      })
    ).toEqual(["google/gemini-3.1-pro-preview", "openai/gpt-4o"])
  })

  it("drops provider wildcards when removing a matching model", () => {
    expect(
      nextEnabledModelPatterns({
        currentPatterns: ["google/*"],
        enabled: false,
        model: googleFlash,
        models: catalog,
      })
    ).toEqual(["google/gemini-3.1-pro-preview"])
  })

  it("collapses to allow-all only when enabling every catalog model", () => {
    expect(
      nextEnabledModelPatterns({
        currentPatterns: ["google/gemini-3.5-flash"],
        enabled: true,
        model: googlePro,
        models: [googleFlash, googlePro],
      })
    ).toBeUndefined()
  })
})
