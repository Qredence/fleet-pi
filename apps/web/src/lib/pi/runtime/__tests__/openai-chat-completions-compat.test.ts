import { describe, expect, it, vi } from "vitest"
import {
  OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT,
  mergeOpenAiChatCompletionsGatewayCompat,
  reconcileOpenAiChatCompletionsModel,
  reconcileRuntimeOccModel,
} from "../openai-chat-completions-compat"
import type * as NeonAiGatewayModule from "../neon-ai-gateway"

vi.mock("../neon-ai-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof NeonAiGatewayModule>()
  return {
    ...actual,
    resolveNeonAiGatewayConfig: vi.fn(() => ({
      apiKey: "nt_live_test",
      baseUrl: "https://branch-api.ai.aws-us-east-2.aws.neon.tech/v1",
      modelIds: actual.NEON_AI_GATEWAY_DEFAULT_MODEL_IDS,
    })),
  }
})

describe("openai-chat-completions-compat", () => {
  it("forces Neon AI Gateway compat flags on OCC models", () => {
    const model = mergeOpenAiChatCompletionsGatewayCompat({
      provider: "openai-chat-completions",
      id: "qwen35-122b-a10b",
      name: "qwen35-122b-a10b",
      api: "openai-completions",
      baseUrl: "https://branch-api.ai.aws-us-east-2.aws.neon.tech/v1",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 32_000,
      compat: {
        supportsStore: true,
        maxTokensField: "max_completion_tokens",
        supportsDeveloperRole: true,
      },
    })

    expect(model?.compat).toEqual(OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT)
  })

  it("leaves non-OCC models unchanged", () => {
    const google = {
      provider: "google",
      id: "gemini-2.5-flash",
      name: "gemini-2.5-flash",
      api: "google-generative-ai" as const,
      baseUrl: "https://generativelanguage.googleapis.com",
      reasoning: false,
      input: ["text" as const],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 32_000,
    }

    expect(mergeOpenAiChatCompletionsGatewayCompat(google)).toBe(google)
  })

  it("remaps legacy OCC model ids to the gateway default model", () => {
    const gatewayModel = {
      provider: "openai-chat-completions",
      id: "qwen35-122b-a10b",
      name: "qwen35-122b-a10b",
      api: "openai-completions" as const,
      baseUrl: "https://branch-api.ai.aws-us-east-2.aws.neon.tech/v1",
      reasoning: false,
      input: ["text" as const],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 32_000,
      compat: { ...OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT },
    }

    const reconciled = reconcileOpenAiChatCompletionsModel(
      {
        modelRuntime: {
          getModel: (provider: string, id: string) =>
            provider === "openai-chat-completions" && id === "qwen35-122b-a10b"
              ? gatewayModel
              : undefined,
        },
      } as never,
      {
        provider: "openai-chat-completions",
        id: "deepseek-v4-flash-free",
        name: "deepseek-v4-flash-free",
        api: "openai-completions",
        baseUrl: "https://branch-api.ai.aws-us-east-2.aws.neon.tech/v1",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128_000,
        maxTokens: 32_000,
      },
      "user-1"
    )

    expect(reconciled?.id).toBe("qwen35-122b-a10b")
    expect(reconciled?.compat).toEqual(OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT)
  })

  it("patches runtime model when legacy id already has gateway compat", () => {
    const gatewayModel = {
      provider: "openai-chat-completions",
      id: "qwen35-122b-a10b",
      name: "qwen35-122b-a10b",
      api: "openai-completions" as const,
      baseUrl: "https://branch-api.ai.aws-us-east-2.aws.neon.tech/v1",
      reasoning: false,
      input: ["text" as const],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 32_000,
      compat: { ...OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT },
    }

    const runtime = {
      services: {
        modelRuntime: {
          getModel: (provider: string, id: string) =>
            provider === "openai-chat-completions" && id === "qwen35-122b-a10b"
              ? gatewayModel
              : undefined,
        },
      },
      session: {
        model: {
          provider: "openai-chat-completions",
          id: "deepseek-v4-flash-free",
          name: "deepseek-v4-flash-free",
          api: "openai-completions",
          baseUrl: gatewayModel.baseUrl,
          reasoning: false,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128_000,
          maxTokens: 32_000,
          compat: { ...OPENAI_CHAT_COMPLETIONS_GATEWAY_COMPAT },
        },
        agent: {
          state: {
            model: undefined as typeof gatewayModel | undefined,
          },
        },
      },
    }
    runtime.session.agent.state.model = runtime.session
      .model as typeof gatewayModel

    reconcileRuntimeOccModel(runtime as never, "user-1")

    expect(runtime.session.agent.state.model.id).toBe("qwen35-122b-a10b")
  })
})
