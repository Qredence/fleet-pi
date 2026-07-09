import { describe, expect, it } from "vitest"
import {
  KNOWN_PROVIDERS,
  PI_PROVIDER_CATALOG,
  PROVIDER_METADATA,
} from "@workspace/hax-design/lib/pi/provider-catalog"

describe("provider catalog", () => {
  it("uses Pi's canonical google provider id for Gemini", () => {
    const google = KNOWN_PROVIDERS.find((provider) => provider.id === "google")

    expect(google).toEqual({
      id: "google",
      name: "Google Gemini",
      envVarName: "GEMINI_API_KEY",
    })
    expect(
      KNOWN_PROVIDERS.some((provider) => provider.id === "google-genai")
    ).toBe(false)
  })

  it("keeps credential and UI metadata aligned for configured providers", () => {
    for (const entry of PI_PROVIDER_CATALOG) {
      if (entry.ui === undefined) continue

      expect(PROVIDER_METADATA[entry.id]).toEqual(entry.ui)
    }
  })

  it("includes Pi-documented gateway and router providers", () => {
    expect(KNOWN_PROVIDERS.map((provider) => provider.id)).toEqual(
      expect.arrayContaining([
        "openrouter",
        "vercel-ai-gateway",
        "github-copilot",
      ])
    )
    expect(
      KNOWN_PROVIDERS.find((provider) => provider.id === "github-copilot")
        ?.authType
    ).toBe("oauth")
  })
})
