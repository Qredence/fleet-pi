import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OPENAI_CHAT_COMPLETIONS_PROVIDER_ID } from "@workspace/pi-protocol/provider-catalog"
import { resolveUserProviderSecret } from "../user-provider-secrets"
import { loadDecryptedUserProviderSecrets } from "@/lib/db/user-providers"

vi.mock("@/lib/db/user-providers", () => ({
  loadDecryptedUserProviderSecrets: vi.fn(),
}))

const ENV_KEYS = [
  "FLEET_PI_CHAT_DATABASE_URL",
  "OPENAI_CHAT_COMPLETIONS_API_KEY",
  "VERCEL",
] as const
const original = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))

describe("OCC secret for local DB-backed signed-in users", () => {
  beforeEach(() => {
    process.env.FLEET_PI_CHAT_DATABASE_URL = "postgres://local-test"
    process.env.OPENAI_CHAT_COMPLETIONS_API_KEY = "env-occ-key"
    delete process.env.VERCEL
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
    vi.mocked(loadDecryptedUserProviderSecrets).mockReset()
  })

  it("prefers the key saved through Settings", async () => {
    vi.mocked(loadDecryptedUserProviderSecrets).mockResolvedValue(
      new Map([[OPENAI_CHAT_COMPLETIONS_PROVIDER_ID, "db-occ-key"]])
    )
    await expect(
      resolveUserProviderSecret("user-1", OPENAI_CHAT_COMPLETIONS_PROVIDER_ID)
    ).resolves.toBe("db-occ-key")
  })

  it("falls back to OPENAI_CHAT_COMPLETIONS_API_KEY when nothing is saved", async () => {
    vi.mocked(loadDecryptedUserProviderSecrets).mockResolvedValue(new Map())
    await expect(
      resolveUserProviderSecret("user-1", OPENAI_CHAT_COMPLETIONS_PROVIDER_ID)
    ).resolves.toBe("env-occ-key")
  })
})
