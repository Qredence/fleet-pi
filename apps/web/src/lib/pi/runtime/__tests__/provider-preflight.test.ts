import { describe, expect, it, vi } from "vitest"
import {
  assertProviderCredentialsUsable,
  describeMisroutedGatewayToken,
} from "../provider-preflight"
import { TEST_NEON_AI_GATEWAY_BASE_URL_V1 } from "./gateway-test-fixtures"

const OPENAI_MODEL = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
}

function sessionWith(
  model: { provider: string; baseUrl: string } | undefined,
  auth?: { apiKey?: string; baseUrl?: string }
) {
  return {
    model,
    modelRuntime: {
      getAuth: vi.fn(() => Promise.resolve(auth ? { auth } : undefined)),
    },
  } as unknown as Parameters<typeof assertProviderCredentialsUsable>[0]
}

describe("describeMisroutedGatewayToken", () => {
  it("flags a Neon AI Gateway token on a non-Neon endpoint", () => {
    const reason = describeMisroutedGatewayToken(OPENAI_MODEL, "nt_live_abc")
    expect(reason).toContain('"openai" provider')
    expect(reason).toContain("api.openai.com")
    expect(reason).not.toContain("nt_live_abc")
  })

  it("allows a Neon AI Gateway token on a Neon endpoint", () => {
    expect(
      describeMisroutedGatewayToken(
        {
          provider: "openai-chat-completions",
          baseUrl: TEST_NEON_AI_GATEWAY_BASE_URL_V1,
        },
        "nt_live_abc"
      )
    ).toBeUndefined()
  })

  it("allows other keys and missing keys", () => {
    expect(
      describeMisroutedGatewayToken(OPENAI_MODEL, "sk-proj-abc")
    ).toBeUndefined()
    expect(
      describeMisroutedGatewayToken(OPENAI_MODEL, undefined)
    ).toBeUndefined()
  })
})

describe("assertProviderCredentialsUsable", () => {
  it("throws before the turn when the resolved key is a misrouted gateway token", async () => {
    await expect(
      assertProviderCredentialsUsable(
        sessionWith(OPENAI_MODEL, { apiKey: "nt_live_abc" })
      )
    ).rejects.toThrow("Neon AI Gateway token")
  })

  it("uses the base URL from the resolved auth when present", async () => {
    await expect(
      assertProviderCredentialsUsable(
        sessionWith(OPENAI_MODEL, {
          apiKey: "nt_live_abc",
          baseUrl: TEST_NEON_AI_GATEWAY_BASE_URL_V1,
        })
      )
    ).resolves.toBeUndefined()
  })

  it("does nothing without a model or without resolved auth", async () => {
    await expect(
      assertProviderCredentialsUsable(sessionWith(undefined))
    ).resolves.toBeUndefined()
    await expect(
      assertProviderCredentialsUsable(sessionWith(OPENAI_MODEL))
    ).resolves.toBeUndefined()
  })

  it("leaves auth resolution errors to Pi", async () => {
    const session = sessionWith(OPENAI_MODEL)
    vi.mocked(session.modelRuntime.getAuth).mockRejectedValueOnce(
      new Error("boom")
    )
    await expect(
      assertProviderCredentialsUsable(session)
    ).resolves.toBeUndefined()
  })
})
