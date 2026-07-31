import { describe, expect, it } from "vitest"
import {
  ChatProviderInfoSchema,
  ChatProviderRemoveRequestSchema,
  ChatProviderUpdateRequestSchema,
} from "@workspace/pi-protocol/chat-protocol.zod"
import { OCC_INSTANCE_ID_PREFIX } from "@workspace/pi-protocol/provider-catalog"

describe("providers OCC wire schema", () => {
  it("accepts a named-instance create request with display name + create flag", () => {
    const parsed = ChatProviderUpdateRequestSchema.safeParse({
      providerId: "openai-chat-completions",
      apiKey: "sk-test",
      baseUrl: "https://opencode.ai/zen/v1",
      modelId: "kimi-k2.6",
      displayName: "OpenCode Zen",
      createOccInstance: true,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.displayName).toBe("OpenCode Zen")
      expect(parsed.data.createOccInstance).toBe(true)
    }
  })

  it("allows updating an existing instance via its instance id", () => {
    const parsed = ChatProviderUpdateRequestSchema.safeParse({
      providerId: `${OCC_INSTANCE_ID_PREFIX}nebius`,
      apiKey: "sk-test",
      baseUrl: "https://api.nebius.com/v1",
      modelId: "deepseek-v3",
    })
    expect(parsed.success).toBe(true)
  })

  it("accepts a remove request for a named instance id", () => {
    const parsed = ChatProviderRemoveRequestSchema.safeParse({
      providerId: `${OCC_INSTANCE_ID_PREFIX}nebius`,
    })
    expect(parsed.success).toBe(true)
  })

  it("round-trips provider rows carrying family + display name", () => {
    const row = ChatProviderInfoSchema.parse({
      id: `${OCC_INSTANCE_ID_PREFIX}nebius`,
      name: "Nebius AI",
      isConfigured: true,
      envVarName: "OPENAI_CHAT_COMPLETIONS_API_KEY",
      providerFamily: "openai-chat-completions",
      displayName: "Nebius AI",
    })
    expect(row.displayName).toBe("Nebius AI")
    expect(row.providerFamily).toBe("openai-chat-completions")
  })
})
