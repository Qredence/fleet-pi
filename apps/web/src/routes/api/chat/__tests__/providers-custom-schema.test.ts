import { describe, expect, it } from "vitest"
import {
  ChatProviderInfoSchema,
  ChatProviderUpdateRequestSchema,
} from "@workspace/pi-protocol/chat-protocol.zod"
import { CUSTOM_PROVIDER_ID_PREFIX } from "@workspace/pi-protocol/provider-catalog"

describe("providers custom-provider wire schema", () => {
  it("accepts a custom provider create request with api family + models", () => {
    const parsed = ChatProviderUpdateRequestSchema.safeParse({
      providerId: "custom",
      apiKey: "sk-test",
      baseUrl: "https://api.example.com/v1",
      displayName: "My Endpoint",
      createOccInstance: true,
      api: "anthropic-messages",
      models: ["claude-compatible-1", "claude-compatible-2"],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.api).toBe("anthropic-messages")
      expect(parsed.data.models).toEqual([
        "claude-compatible-1",
        "claude-compatible-2",
      ])
    }
  })

  it("allows updating an existing custom provider via its instance id", () => {
    const parsed = ChatProviderUpdateRequestSchema.safeParse({
      providerId: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`,
      apiKey: "sk-test",
      baseUrl: "https://api.example.com/v1",
      api: "openai-completions",
      models: ["gpt-compatible"],
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects an unknown api family", () => {
    const parsed = ChatProviderUpdateRequestSchema.safeParse({
      providerId: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`,
      apiKey: "sk-test",
      api: "not-a-real-api",
      models: ["some-model"],
    })
    expect(parsed.success).toBe(false)
  })

  it("rejects models lists that exceed the wire bounds", () => {
    const tooMany = ChatProviderUpdateRequestSchema.safeParse({
      providerId: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`,
      apiKey: "sk-test",
      api: "openai-completions",
      models: Array.from({ length: 65 }, (_, i) => `model-${i}`),
    })
    expect(tooMany.success).toBe(false)

    const tooLong = ChatProviderUpdateRequestSchema.safeParse({
      providerId: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`,
      apiKey: "sk-test",
      api: "openai-completions",
      models: ["m".repeat(4097)],
    })
    expect(tooLong.success).toBe(false)
  })

  it("round-trips provider rows carrying api + modelIds", () => {
    const row = ChatProviderInfoSchema.parse({
      id: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`,
      name: "My Endpoint",
      isConfigured: true,
      envVarName: "",
      api: "google-genai",
      modelIds: ["gemini-compatible"],
      displayName: "My Endpoint",
    })
    expect(row.api).toBe("google-genai")
    expect(row.modelIds).toEqual(["gemini-compatible"])
  })

  it("rejects modelIds lists that exceed the wire bounds", () => {
    const tooMany = ChatProviderInfoSchema.safeParse({
      id: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`,
      name: "My Endpoint",
      isConfigured: true,
      envVarName: "",
      modelIds: Array.from({ length: 65 }, (_, i) => `model-${i}`),
    })
    expect(tooMany.success).toBe(false)
  })
})
