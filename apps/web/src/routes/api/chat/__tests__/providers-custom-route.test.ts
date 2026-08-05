import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  CUSTOM_PROVIDER_ID_PREFIX,
  OCC_INSTANCE_ID_PREFIX,
} from "@workspace/pi-protocol/provider-catalog"

import { providersServerHandlers } from "../providers"

const {
  withAuthenticatedChatRequestMock,
  isChatAuthRequiredMock,
  getChatAuthSessionMock,
} = vi.hoisted(() => ({
  withAuthenticatedChatRequestMock: vi.fn(),
  isChatAuthRequiredMock: vi.fn(() => false),
  getChatAuthSessionMock: vi.fn(() => null),
}))

const {
  listLocalProviderInstancesWithApiKeyMock,
  getLocalProviderInstanceMock,
  removeLocalProviderInstanceMock,
  upsertLocalProviderInstanceMock,
  createLocalProviderInstanceMock,
  useLocalProviderStoreMock,
} = vi.hoisted(() => ({
  listLocalProviderInstancesWithApiKeyMock: vi.fn(() => []),
  getLocalProviderInstanceMock: vi.fn(),
  removeLocalProviderInstanceMock: vi.fn(),
  upsertLocalProviderInstanceMock: vi.fn(),
  createLocalProviderInstanceMock: vi.fn(),
  useLocalProviderStoreMock: vi.fn(() => true),
}))

const {
  listOccInstancesWithApiKeyMock,
  getOccInstanceByIdMock,
  removeOccInstanceMock,
  upsertOccInstanceMock,
  allocateOccInstanceIdMock,
  allocateCustomProviderIdMock,
} = vi.hoisted(() => ({
  listOccInstancesWithApiKeyMock: vi.fn(() => []),
  getOccInstanceByIdMock: vi.fn(),
  removeOccInstanceMock: vi.fn(),
  upsertOccInstanceMock: vi.fn(),
  allocateOccInstanceIdMock: vi.fn(
    () => `${OCC_INSTANCE_ID_PREFIX}my-endpoint`
  ),
  allocateCustomProviderIdMock: vi.fn(
    () => `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`
  ),
}))

const { storeUserProviderApiKeyMock } = vi.hoisted(() => ({
  storeUserProviderApiKeyMock: vi.fn(),
}))

const {
  getProviderConfigStatusMock,
  hotReloadActiveRuntimesForUserMock,
  hotReloadProviderAuthForActiveRuntimesMock,
} = vi.hoisted(() => ({
  getProviderConfigStatusMock: vi.fn(() => []),
  hotReloadActiveRuntimesForUserMock: vi.fn(),
  hotReloadProviderAuthForActiveRuntimesMock: vi.fn(),
}))

vi.mock("@/lib/auth/chat-api-auth", () => ({
  withAuthenticatedChatRequest: withAuthenticatedChatRequestMock,
  isChatAuthRequired: isChatAuthRequiredMock,
  getChatAuthSession: getChatAuthSessionMock,
}))

vi.mock("@/lib/deployment/environment", () => ({
  isVercelDeployment: () => false,
}))

// The loopback http policy and instance-usable checks branch on the deployed
// surface; pin it to local dev so the tests don't flip if VERCEL is set.
vi.mock("@/lib/pi/runtime/deployed-chat-runtime", () => ({
  isDeployedChatRuntimeSurface: () => false,
}))

vi.mock("@/lib/db/local-provider-instances", () => ({
  createLocalProviderInstance: createLocalProviderInstanceMock,
  getLocalProviderInstance: getLocalProviderInstanceMock,
  listLocalProviderInstancesWithApiKey:
    listLocalProviderInstancesWithApiKeyMock,
  removeLocalProviderInstance: removeLocalProviderInstanceMock,
  upsertLocalProviderInstance: upsertLocalProviderInstanceMock,
  useLocalProviderStore: useLocalProviderStoreMock,
}))

vi.mock("@/lib/db/occ-instances", () => ({
  allocateCustomProviderId: allocateCustomProviderIdMock,
  allocateOccInstanceId: allocateOccInstanceIdMock,
  getOccInstanceById: getOccInstanceByIdMock,
  listOccInstancesWithApiKey: listOccInstancesWithApiKeyMock,
  removeOccInstance: removeOccInstanceMock,
  upsertOccInstance: upsertOccInstanceMock,
}))

vi.mock("@/lib/db/user-providers", () => ({
  storeUserProviderApiKey: storeUserProviderApiKeyMock,
}))

vi.mock("@/lib/pi/runtime", () => ({
  getProviderConfigStatus: getProviderConfigStatusMock,
  hotReloadActiveRuntimesForUser: hotReloadActiveRuntimesForUserMock,
  hotReloadProviderAuthForActiveRuntimes:
    hotReloadProviderAuthForActiveRuntimesMock,
}))

vi.mock("@/lib/daytona/refresh-sandbox-credentials", () => ({
  refreshSandboxProviderCredentials: vi.fn(),
}))

vi.mock("@/lib/pi/runtime/remove-provider-bundle", () => ({
  removeProviderBundle: vi.fn(),
}))

vi.mock("@/lib/pi/runtime/provider-credential-bundle", () => ({
  isRemovableCredentialProvider: vi.fn(),
  resolveProviderCredentialBundle: vi.fn(),
}))

vi.mock("@/lib/pi/server", () => ({
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}))

vi.mock("@/lib/app-runtime", () => ({
  resolveAppRuntimeContext: () => ({
    projectRoot: "/repo",
    workspaceRoot: "/repo/agent-workspace",
  }),
  getResponseStatus: () => 500,
}))

vi.mock("@/lib/pi/runtime/openai-chat-completions-provider", async () => {
  const url = await import("@/lib/pi/runtime/openai-chat-completions-url")
  return {
    assertSafeOpenAiCompatibleBaseUrl: url.assertSafeOpenAiCompatibleBaseUrl,
  }
})

const handlers = providersServerHandlers

let currentUserId: string | undefined

beforeEach(() => {
  currentUserId = undefined
  vi.clearAllMocks()
  withAuthenticatedChatRequestMock.mockImplementation(
    (
      _request: Request,
      handler: (ctx: { userId?: string }) => Promise<Response>
    ) => handler({ userId: currentUserId })
  )
  useLocalProviderStoreMock.mockReturnValue(true)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/chat/providers with createOccInstance", () => {
  const postRequest = (body: Record<string, unknown>) =>
    new Request("http://localhost/api/chat/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })

  it("exposes the server handlers for the providers route", () => {
    expect(handlers.POST).toBeTypeOf("function")
    expect(handlers.DELETE).toBeTypeOf("function")
  })

  it("creates a local custom provider instance anonymously (no 400)", async () => {
    const response = await handlers.POST({
      request: postRequest({
        providerId: "custom",
        apiKey: "sk-test",
        baseUrl: "https://api.example.com/v1",
        displayName: "My Endpoint",
        createOccInstance: true,
        api: "openai-completions",
        models: ["gpt-compatible"],
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true })
    expect(createLocalProviderInstanceMock).toHaveBeenCalledWith(
      undefined,
      {
        displayName: "My Endpoint",
        baseUrl: "https://api.example.com/v1",
        api: "openai-completions",
        modelIds: ["gpt-compatible"],
      },
      expect.any(Function),
      "sk-test"
    )
    expect(upsertLocalProviderInstanceMock).not.toHaveBeenCalled()
    expect(upsertOccInstanceMock).not.toHaveBeenCalled()
  })

  it("accepts a loopback http base URL for OCC-family providers in local dev", async () => {
    const response = await handlers.POST({
      request: postRequest({
        providerId: "custom",
        apiKey: "sk-test",
        baseUrl: "http://localhost:11434/v1",
        displayName: "Local LLM",
        createOccInstance: true,
        api: "openai-completions",
        models: ["llama-3.2"],
      }),
    })

    expect(response.status).toBe(200)
    expect(createLocalProviderInstanceMock).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        baseUrl: "http://localhost:11434/v1",
        api: "openai-completions",
      }),
      expect.any(Function),
      "sk-test"
    )
    expect(upsertLocalProviderInstanceMock).not.toHaveBeenCalled()
  })

  it("keeps the https-only rule for a loopback base URL on a non-OCC family", async () => {
    const response = await handlers.POST({
      request: postRequest({
        providerId: "custom",
        apiKey: "sk-test",
        baseUrl: "http://localhost:11434",
        displayName: "Local Claude",
        createOccInstance: true,
        api: "anthropic-messages",
        models: ["claude-compatible"],
      }),
    })

    expect(response.status).toBe(400)
    expect(createLocalProviderInstanceMock).not.toHaveBeenCalled()
    expect(upsertLocalProviderInstanceMock).not.toHaveBeenCalled()
  })

  it("routes to Postgres when the local store is not selected", async () => {
    currentUserId = "user-1"
    useLocalProviderStoreMock.mockReturnValue(false)

    const response = await handlers.POST({
      request: postRequest({
        providerId: "custom",
        apiKey: "sk-test",
        baseUrl: "https://api.example.com/v1",
        displayName: "My Endpoint",
        createOccInstance: true,
        api: "openai-completions",
        models: ["gpt-compatible"],
      }),
    })

    expect(response.status).toBe(200)
    expect(createLocalProviderInstanceMock).not.toHaveBeenCalled()
    expect(upsertLocalProviderInstanceMock).not.toHaveBeenCalled()
    expect(upsertOccInstanceMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        id: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`,
      }),
      "sk-test"
    )
  })

  it("updates an existing local instance in place (no new id allocation)", async () => {
    const existingId = `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`
    const response = await handlers.POST({
      request: postRequest({
        providerId: existingId,
        apiKey: "sk-updated",
        baseUrl: "https://api.example.com/v2",
        displayName: "My Endpoint",
        api: "openai-completions",
        models: ["gpt-compatible", "another-model"],
      }),
    })

    expect(response.status).toBe(200)
    expect(createLocalProviderInstanceMock).not.toHaveBeenCalled()
    expect(upsertLocalProviderInstanceMock).toHaveBeenCalledWith(
      undefined,
      {
        displayName: "My Endpoint",
        baseUrl: "https://api.example.com/v2",
        api: "openai-completions",
        modelIds: ["gpt-compatible", "another-model"],
        id: existingId,
      },
      "sk-updated"
    )
    expect(upsertOccInstanceMock).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/chat/providers for a local custom instance", () => {
  const deleteRequest = (providerId: string) =>
    new Request("http://localhost/api/chat/providers", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId }),
    })

  it("removes an existing local instance", async () => {
    getLocalProviderInstanceMock.mockResolvedValue({
      id: `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`,
      displayName: "My Endpoint",
      baseUrl: "https://api.example.com/v1",
      modelId: "gpt-compatible",
    })

    const response = await handlers.DELETE({
      request: deleteRequest(`${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`),
    })

    expect(response.status).toBe(200)
    expect(removeLocalProviderInstanceMock).toHaveBeenCalledWith(
      undefined,
      `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`
    )
    expect(removeOccInstanceMock).not.toHaveBeenCalled()
  })

  it("returns 400 for an unknown local instance", async () => {
    getLocalProviderInstanceMock.mockResolvedValue(null)

    const response = await handlers.DELETE({
      request: deleteRequest(`${CUSTOM_PROVIDER_ID_PREFIX}missing`),
    })

    expect(response.status).toBe(400)
    expect(removeLocalProviderInstanceMock).not.toHaveBeenCalled()
  })
})
