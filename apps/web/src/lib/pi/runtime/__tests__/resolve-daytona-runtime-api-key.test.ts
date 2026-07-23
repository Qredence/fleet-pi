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

  it("prefers override, then local DAYTONA_API_KEY when not on Vercel", async () => {
    process.env.ORG_DAYTONA_API_KEY = "org-key"
    process.env.DAYTONA_API_KEY = "legacy-key"

    await expect(
      resolveDaytonaRuntimeApiKey(undefined, "override")
    ).resolves.toBe("override")
    await expect(resolveDaytonaRuntimeApiKey(undefined)).resolves.toBe(
      "legacy-key"
    )
  })

  it("never uses ORG_DAYTONA_API_KEY for user sandboxes", async () => {
    process.env.ORG_DAYTONA_API_KEY = "org-key"
    delete process.env.DAYTONA_API_KEY

    await expect(
      resolveDaytonaRuntimeApiKey(undefined)
    ).resolves.toBeUndefined()
    await expect(resolveDaytonaRuntimeApiKey("user-1")).resolves.toBeUndefined()
  })

  it("does not fall back to org or DAYTONA_API_KEY on Vercel without BYOK", async () => {
    process.env.VERCEL = "1"
    process.env.ORG_DAYTONA_API_KEY = "org-key"
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
