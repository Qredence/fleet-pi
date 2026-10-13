import { describe, expect, it } from "vitest"
import { isChatListModel, nextEnabledModelPatterns } from "../model-patterns"
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

describe("isChatListModel", () => {
  const chatModels = [{ provider: "custom+command", modelId: "saved-model" }]

  it("keeps only the chat picker when no enabled list has been saved", () => {
    expect(
      isChatListModel(
        {
          id: "custom+command/saved-model",
          name: "saved-model",
          provider: "custom+command",
          modelId: "saved-model",
        },
        undefined,
        chatModels
      )
    ).toBe(true)
    expect(
      isChatListModel(
        {
          id: "custom+command/gpt-5.5",
          name: "GPT-5.5",
          provider: "custom+command",
          modelId: "gpt-5.5",
        },
        undefined,
        chatModels
      )
    ).toBe(false)
  })
})

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

  it("returns explicit list when enabling every catalog model (no collapse to allow-all)", () => {
    expect(
      nextEnabledModelPatterns({
        currentPatterns: ["google/gemini-3.5-flash"],
        enabled: true,
        model: googlePro,
        models: [googleFlash, googlePro],
      })
    ).toEqual(["google/gemini-3.5-flash", "google/gemini-3.1-pro-preview"])
  })

  it("adds a chat model when nothing has been curated yet", () => {
    expect(
      nextEnabledModelPatterns({
        currentPatterns: undefined,
        enabled: true,
        model: openAiModel,
        models: [googleFlash],
      })
    ).toEqual(["google/gemini-3.5-flash", "openai/gpt-4o"])
  })

  it("adds model to empty deny-all list", () => {
    expect(
      nextEnabledModelPatterns({
        currentPatterns: [],
        enabled: true,
        model: googleFlash,
        models: catalog,
      })
    ).toEqual(["google/gemini-3.5-flash"])
  })
})
