import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  SessionManager,
  SettingsManager,
  createAgentSessionFromServices,
  createAgentSessionServices,
} from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import { resetCapturedNeonAiGatewayCredentialsForTests } from "../neon-ai-gateway"
import { registerOpenAiChatCompletionsProvider } from "../openai-chat-completions-provider"
import { TEST_NEON_AI_GATEWAY_BASE_URL } from "./gateway-test-fixtures"
import type {
  AgentSessionEvent,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent"

vi.mock("@/lib/db/occ-instances", () => ({
  listOccInstances: vi.fn(() => []),
  loadOccInstanceApiKey: vi.fn(),
}))

vi.mock("@/lib/db/local-provider-instances", () => ({
  listLocalProviderInstances: vi.fn(() => []),
  useLocalProviderStore: vi.fn(() => false),
}))

const PROVIDER_ID = "openai-chat-completions"
const MODEL_ID = "qwen35-122b-a10b"

/** Minimal OpenAI Chat Completions SSE body. */
function sse(chunks: Array<Record<string, unknown>>) {
  const body = [
    ...chunks.map(
      (delta, index) =>
        `data: ${JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion.chunk",
          created: 1,
          model: MODEL_ID,
          choices: [
            {
              index: 0,
              delta,
              finish_reason:
                index === chunks.length - 1
                  ? delta.tool_calls
                    ? "tool_calls"
                    : "stop"
                  : null,
            },
          ],
        })}\n\n`
    ),
    "data: [DONE]\n\n",
  ].join("")
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  })
}

const echoTool = {
  name: "echo",
  label: "echo",
  description: "Echo the value back",
  parameters: Type.Object({ v: Type.String() }),
  execute: (_id: string, params: { v: string }) =>
    Promise.resolve({
      content: [{ type: "text" as const, text: `echo:${params.v}` }],
      details: {},
    }),
} as unknown as ToolDefinition

describe("OpenAI-compatible provider at runtime (real Pi session)", () => {
  const originalToken = process.env.NEON_AI_GATEWAY_TOKEN
  const originalBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL

  beforeEach(() => {
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = "nt_live_test_token"
    process.env.NEON_AI_GATEWAY_BASE_URL = TEST_NEON_AI_GATEWAY_BASE_URL
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetCapturedNeonAiGatewayCredentialsForTests()
    process.env.NEON_AI_GATEWAY_TOKEN = originalToken
    process.env.NEON_AI_GATEWAY_BASE_URL = originalBaseUrl
  })

  it("streams text and runs a tool call through the registered provider", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = []
    const responses = [
      sse([
        { role: "assistant", content: "Checking" },
        {
          tool_calls: [
            {
              index: 0,
              id: "call_1",
              type: "function",
              function: { name: "echo", arguments: '{"v":"x"}' },
            },
          ],
        },
      ]),
      sse([{ role: "assistant", content: "Done" }, { content: "." }]),
    ]
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : input.toString()
      requests.push({ url, body: JSON.parse(String(init?.body ?? "{}")) })
      const next = responses.shift()
      if (!next) throw new Error(`unexpected request to ${url}`)
      return Promise.resolve(next)
    })

    const cwd = mkdtempSync(join(tmpdir(), "fleet-pi-occ-runtime-"))
    const services = await createAgentSessionServices({
      cwd,
      agentDir: join(cwd, "agent"),
      settingsManager: SettingsManager.inMemory({
        retry: { enabled: false },
        compaction: { enabled: false },
      }),
    })
    await registerOpenAiChatCompletionsProvider(services, "user-1")
    const model = services.modelRuntime.getModel(PROVIDER_ID, MODEL_ID)
    expect(model).toBeDefined()

    const { session } = await createAgentSessionFromServices({
      services,
      sessionManager: SessionManager.inMemory(cwd),
      model,
      tools: ["echo"],
      customTools: [echoTool],
    })

    const events: Array<AgentSessionEvent> = []
    session.subscribe((event) => events.push(event))
    try {
      await session.prompt("echo x")
      await session.waitForIdle()
    } finally {
      session.dispose()
    }

    expect(requests).toHaveLength(2)
    expect(requests[0].url).toBe(
      `${TEST_NEON_AI_GATEWAY_BASE_URL}/v1/chat/completions`
    )
    expect(requests[0].body).toMatchObject({ model: MODEL_ID, stream: true })

    const textDeltas = events.flatMap((event) =>
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
        ? [event.assistantMessageEvent.delta]
        : []
    )
    expect(textDeltas.join("")).toBe("CheckingDone.")

    const toolEnd = events.find((event) => event.type === "tool_execution_end")
    expect(toolEnd).toMatchObject({
      toolCallId: "call_1",
      toolName: "echo",
      isError: false,
    })

    const lastAssistant = session.messages.at(-1)
    expect(lastAssistant).toMatchObject({
      role: "assistant",
      provider: PROVIDER_ID,
      model: MODEL_ID,
      stopReason: "stop",
    })
  })
})
