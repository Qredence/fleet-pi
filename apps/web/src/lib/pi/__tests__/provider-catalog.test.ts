import { describe, expect, it } from "vitest"
import {
  KNOWN_PROVIDERS,
  PI_PROVIDER_CATALOG,
} from "@workspace/pi-protocol/provider-catalog"
import { PROVIDER_METADATA } from "@workspace/hax-design/components/fleet-pi/pi/config-panel/shared/provider-metadata"

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
      if (!(entry.id in PROVIDER_METADATA)) continue
      const ui = PROVIDER_METADATA[entry.id]

      expect(ui.placeholder.length).toBeGreaterThan(0)
      expect(ui.help.length).toBeGreaterThan(0)
    }
  })

  it("includes Pi-documented gateway and router providers", () => {
    expect(KNOWN_PROVIDERS.map((provider) => provider.id)).toEqual(
      expect.arrayContaining([
        "openrouter",
        "vercel-ai-gateway",
        "github-copilot",
        "openai-chat-completions",
      ])
    )
    expect(
      KNOWN_PROVIDERS.find((provider) => provider.id === "github-copilot")
        ?.authType
    ).toBe("oauth")
  })
})
