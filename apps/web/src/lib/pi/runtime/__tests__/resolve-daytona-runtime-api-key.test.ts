import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resolveDaytonaRuntimeApiKey } from "../user-provider-secrets"

vi.mock("@/lib/db/user-providers", () => ({
  loadDecryptedUserProviderSecrets: vi.fn().mockResolvedValue(new Map()),
}))

const originalOrgKey = process.env.ORG_DAYTONA_API_KEY
const originalDaytonaKey = process.env.DAYTONA_API_KEY
const originalVercel = process.env.VERCEL

describe("resolveDaytonaRuntimeApiKey", () => {
  beforeEach(() => {
    delete process.env.ORG_DAYTONA_API_KEY
    delete process.env.DAYTONA_API_KEY
    delete process.env.VERCEL
  })

  afterEach(() => {
    restoreEnv("ORG_DAYTONA_API_KEY", originalOrgKey)
    restoreEnv("DAYTONA_API_KEY", originalDaytonaKey)
    restoreEnv("VERCEL", originalVercel)
  })

  it("prefers override, then ORG_DAYTONA_API_KEY over DAYTONA_API_KEY", async () => {
    process.env.ORG_DAYTONA_API_KEY = "org-key"
    process.env.DAYTONA_API_KEY = "legacy-key"

    await expect(
      resolveDaytonaRuntimeApiKey(undefined, "override")
    ).resolves.toBe("override")
    await expect(resolveDaytonaRuntimeApiKey(undefined)).resolves.toBe(
      "org-key"
    )
  })

  it("uses ORG_DAYTONA_API_KEY on Vercel when the user has no BYOK", async () => {
    process.env.VERCEL = "1"
    process.env.ORG_DAYTONA_API_KEY = "org-key"
    process.env.DAYTONA_API_KEY = "legacy-key"

    await expect(resolveDaytonaRuntimeApiKey("user-1")).resolves.toBe("org-key")
  })

  it("does not fall back to DAYTONA_API_KEY on Vercel without ORG key", async () => {
    process.env.VERCEL = "1"
    process.env.DAYTONA_API_KEY = "legacy-key"

    await expect(resolveDaytonaRuntimeApiKey("user-1")).resolves.toBeUndefined()
  })
})

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}
