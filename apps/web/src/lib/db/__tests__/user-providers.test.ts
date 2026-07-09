import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  ChatPostgresUnavailableError,
  loadDecryptedUserProviderSecrets,
  upsertUserProviderEncryptedKey,
} from "@/lib/db/user-providers"

const mocks = vi.hoisted(() => ({
  withChatPostgresTransaction: vi.fn(),
  decryptString: vi.fn((value: string) => `decrypted:${value}`),
}))

vi.mock("@/lib/db/pi-session-mirror", () => ({
  withChatPostgresTransaction: mocks.withChatPostgresTransaction,
}))

vi.mock("@/lib/auth/crypto", () => ({
  decryptString: mocks.decryptString,
}))

describe("user-providers store", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mocks.withChatPostgresTransaction.mockImplementation(
      (operation: (client: unknown) => Promise<void>) => {
        return operation({
          query: vi.fn(async () => ({ rows: [] })),
        })
      }
    )
  })

  it("throws on Vercel when chat database URL is missing for upsert", async () => {
    vi.stubEnv("VERCEL", "1")
    delete process.env.FLEET_PI_CHAT_DATABASE_URL

    await expect(
      upsertUserProviderEncryptedKey("user-1", "google", "cipher")
    ).rejects.toBeInstanceOf(ChatPostgresUnavailableError)
  })

  it("decrypts stored provider secrets for a single provider", async () => {
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("FLEET_PI_CHAT_DATABASE_URL", "postgres://example")
    vi.stubEnv("BETTER_AUTH_SECRET", "secret")

    mocks.withChatPostgresTransaction.mockImplementation(
      (operation: (client: unknown) => Promise<void>) => {
        return operation({
          query: vi.fn(async () => ({
            rows: [{ provider_id: "daytona", encrypted_key: "cipher-text" }],
          })),
        })
      }
    )

    const secrets = await loadDecryptedUserProviderSecrets("user-1", {
      providerId: "daytona",
    })

    expect(secrets.get("daytona")).toBe("decrypted:cipher-text")
    expect(mocks.decryptString).toHaveBeenCalledWith("cipher-text", "secret")
  })
})
