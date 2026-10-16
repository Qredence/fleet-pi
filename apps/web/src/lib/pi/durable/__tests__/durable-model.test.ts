import { describe, expect, it } from "vitest"
import { sameDurableModelConfig } from "../durable-model"
import type { DurableAgentModelConfig } from "../durable-model"

const config: DurableAgentModelConfig = {
  provider: "openai-chat-completions",
  modelId: "gpt-oss-120b",
  apiKey: "key-a",
  baseUrl: "https://gateway.example/v1",
  api: "openai-completions",
}

describe("sameDurableModelConfig", () => {
  it("reuses the harness only for an identical model config", () => {
    expect(sameDurableModelConfig(config, { ...config })).toBe(true)
  })

  it("reopens when nothing is open yet", () => {
    expect(sameDurableModelConfig(undefined, config)).toBe(false)
  })

  it("reopens after a rotated API key", () => {
    expect(sameDurableModelConfig(config, { ...config, apiKey: "key-b" })).toBe(
      false
    )
  })

  it("reopens when the endpoint or wire API changes", () => {
    expect(
      sameDurableModelConfig(config, {
        ...config,
        baseUrl: "https://other.example/v1",
      })
    ).toBe(false)
    expect(
      sameDurableModelConfig(config, { ...config, api: "openai-responses" })
    ).toBe(false)
    expect(
      sameDurableModelConfig(config, { ...config, modelId: "other" })
    ).toBe(false)
  })
})
