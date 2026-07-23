import { afterEach, describe, expect, it, vi } from "vitest"
import { chatCommandsHandler } from "../../../routes/api/chat/commands"
import { chatModelsHandler } from "../../../routes/api/chat/models"
import { chatModelsDiscoverHandler } from "../../../routes/api/chat/models.discover"
import { chatResourcesHandler } from "../../../routes/api/chat/resources"
import { auth } from "@/lib/auth/server"

vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock("@/lib/pi/server", () => ({
  loadChatModels: vi.fn(() =>
    Promise.resolve({ models: [], defaultModel: null })
  ),
  loadChatResources: vi.fn(() => Promise.resolve({ resources: [] })),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}))

vi.mock("@/lib/pi/runtime/command-catalog", () => ({
  loadChatCommands: vi.fn(() => Promise.resolve({ commands: [] })),
}))

vi.mock("@/lib/workspace/workspace-context", () => ({
  resolveWorkspaceContext: vi.fn(() =>
    Promise.resolve({
      projectRoot: "/repo",
      workspaceRoot: "/repo/agent-workspace",
    })
  ),
}))

vi.mock("@/lib/app-runtime", () => ({
  resolveAppRuntimeContext: vi.fn(() => ({
    projectRoot: "/repo",
    workspaceRoot: "/repo/agent-workspace",
  })),
  getResponseStatus: () => 500,
}))

vi.mock("@/lib/pi/runtime/openai-chat-completions-provider", () => ({
  discoverOpenAiChatCompletionsModels: vi.fn(() => Promise.resolve([])),
}))

const originalVercel = process.env.VERCEL
const originalNeonAuthBase = process.env.NEON_AUTH_BASE_URL
const originalNeonAuthUrl = process.env.NEON_AUTH_URL
const originalChatRuntimeAuth = process.env.FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH

function clearDeployedChatAuthEnv() {
  delete process.env.VERCEL
  delete process.env.NEON_AUTH_BASE_URL
  delete process.env.NEON_AUTH_URL
  delete process.env.FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH
}

function restoreDeployedChatAuthEnv() {
  if (originalVercel === undefined) {
    delete process.env.VERCEL
  } else {
    process.env.VERCEL = originalVercel
  }
  if (originalNeonAuthBase === undefined) {
    delete process.env.NEON_AUTH_BASE_URL
  } else {
    process.env.NEON_AUTH_BASE_URL = originalNeonAuthBase
  }
  if (originalNeonAuthUrl === undefined) {
    delete process.env.NEON_AUTH_URL
  } else {
    process.env.NEON_AUTH_URL = originalNeonAuthUrl
  }
  if (originalChatRuntimeAuth === undefined) {
    delete process.env.FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH
  } else {
    process.env.FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH = originalChatRuntimeAuth
  }
}

afterEach(() => {
  vi.clearAllMocks()
  restoreDeployedChatAuthEnv()
})

describe("chat catalog route auth", () => {
  it("returns 401 for catalog routes on Vercel without a session", async () => {
    clearDeployedChatAuthEnv()
    process.env.VERCEL = "1"
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const models = await chatModelsHandler(
      new Request("http://localhost/api/chat/models")
    )
    const resources = await chatResourcesHandler(
      new Request("http://localhost/api/chat/resources")
    )
    const commands = await chatCommandsHandler(
      new Request("http://localhost/api/chat/commands")
    )
    const discover = await chatModelsDiscoverHandler(
      new Request("http://localhost/api/chat/models/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId: "google" }),
      })
    )

    expect(models.status).toBe(401)
    expect(resources.status).toBe(401)
    expect(commands.status).toBe(401)
    expect(discover.status).toBe(401)
  })

  it("allows catalog routes locally without a session", async () => {
    clearDeployedChatAuthEnv()
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const models = await chatModelsHandler(
      new Request("http://localhost/api/chat/models")
    )
    const resources = await chatResourcesHandler(
      new Request("http://localhost/api/chat/resources")
    )
    const commands = await chatCommandsHandler(
      new Request("http://localhost/api/chat/commands")
    )

    expect(models.status).toBe(200)
    expect(resources.status).toBe(200)
    expect(commands.status).toBe(200)
  })
})
