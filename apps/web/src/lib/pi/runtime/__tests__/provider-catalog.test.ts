import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getProviderConfigStatus } from "../provider-catalog"

const mocks = vi.hoisted(() => ({
  isEnvVarConfigured: vi.fn((_key?: string) => false),
  withChatPostgresTransaction: vi.fn(),
}))

vi.mock("@/lib/env-manager", () => ({
  isEnvVarConfigured: mocks.isEnvVarConfigured,
}))

vi.mock("@/lib/db/pi-session-mirror", () => ({
  withChatPostgresTransaction: mocks.withChatPostgresTransaction,
}))

describe("runtime provider catalog", () => {
  const originalVercel = process.env.VERCEL

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env.VERCEL = originalVercel
    vi.resetModules()
  })

  it("marks Vercel providers configured from pi_user_providers rows", async () => {
    process.env.VERCEL = "1"
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://test"
    mocks.withChatPostgresTransaction.mockImplementation(
      async (callback: (client: unknown) => Promise<void>) => {
        await callback({
          query: vi.fn().mockResolvedValue({
            rows: [{ provider_id: "google" }],
          }),
        })
      }
    )

    const providers = await getProviderConfigStatus({ userId: "user-1" })
    const google = providers.find((provider) => provider.id === "google")

    expect(google?.isConfigured).toBe(true)
    expect(
      providers.find((provider) => provider.id === "openai")?.isConfigured
    ).toBe(false)
  })

  it("marks local providers configured from authStorage runtime keys", async () => {
    delete process.env.VERCEL
    mocks.isEnvVarConfigured.mockReturnValue(false)

    const providers = await getProviderConfigStatus({
      services: {
        authStorage: {
          getRuntimeApiKey: (providerId: string) =>
            providerId === "anthropic" ? "sk-test" : undefined,
        },
      } as never,
    })

    expect(
      providers.find((provider) => provider.id === "anthropic")?.isConfigured
    ).toBe(true)
    expect(
      providers.find((provider) => provider.id === "google")?.isConfigured
    ).toBe(false)
  })

  it("requires key, base URL, and model ID for OpenAI Chat Completions", async () => {
    delete process.env.VERCEL
    mocks.isEnvVarConfigured.mockImplementation((key?: string) =>
      key === "OPENAI_CHAT_COMPLETIONS_API_KEY" ? true : false
    )

    const providers = await getProviderConfigStatus()
    expect(
      providers.find((provider) => provider.id === "openai-chat-completions")
        ?.isConfigured
    ).toBe(false)

    mocks.isEnvVarConfigured.mockImplementation((key?: string) =>
      [
        "OPENAI_CHAT_COMPLETIONS_API_KEY",
        "OPENAI_CHAT_COMPLETIONS_BASE_URL",
      ].includes(key ?? "")
    )

    const missingModel = await getProviderConfigStatus()
    expect(
      missingModel.find((provider) => provider.id === "openai-chat-completions")
        ?.isConfigured
    ).toBe(false)

    mocks.isEnvVarConfigured.mockImplementation((key?: string) =>
      [
        "OPENAI_CHAT_COMPLETIONS_API_KEY",
        "OPENAI_CHAT_COMPLETIONS_BASE_URL",
        "OPENAI_CHAT_COMPLETIONS_MODEL",
      ].includes(key ?? "")
    )

    const configured = await getProviderConfigStatus()
    expect(
      configured.find((provider) => provider.id === "openai-chat-completions")
        ?.isConfigured
    ).toBe(true)
  })
})
