import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createAgentSessionServices } from "@earendil-works/pi-coding-agent"
import { OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT } from "../openai-chat-completions-compat"
import { registerOpenAiChatCompletionsProvider } from "../openai-chat-completions-provider"

describe("registerOpenAiChatCompletionsProvider gateway compat", () => {
  const originalToken = process.env.NEON_AI_GATEWAY_TOKEN
  const originalBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL

  beforeEach(() => {
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_test_token"
    process.env.NEON_AI_GATEWAY_BASE_URL =
      "https://branch-id-api.ai.aws-us-east-2.aws.neon.tech"
  })

  afterEach(() => {
    process.env.NEON_AI_GATEWAY_TOKEN = originalToken
    process.env.NEON_AI_GATEWAY_BASE_URL = originalBaseUrl
  })

  it("registers gateway models with Neon-safe compat flags", async () => {
    const services = await createAgentSessionServices({
      cwd: process.cwd(),
    })
    await registerOpenAiChatCompletionsProvider(services, "user-1")

    const model = services.modelRuntime.getModel(
      "openai-chat-completions",
      "qwen35-122b-a10b"
    )
    expect(model).toBeDefined()
    expect(model?.compat).toMatchObject(OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT)
  })
})
