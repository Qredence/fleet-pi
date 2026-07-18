import { describe, expect, it } from "vitest"
import { buildPlaintextSandboxCredentials } from "./sandbox-provider-secrets"

describe("buildPlaintextSandboxCredentials", () => {
  it("omits Secrets-backed API keys from env and auth.json when mounted", () => {
    const result = buildPlaintextSandboxCredentials(
      new Map([
        ["google", "gem-secret"],
        ["openai", "oai-secret"],
        ["github-copilot", JSON.stringify({ token: "copilot" })],
      ]),
      new Set(["GEMINI_API_KEY", "OPENAI_API_KEY"])
    )

    expect(result.envVars.GEMINI_API_KEY).toBeUndefined()
    expect(result.envVars.OPENAI_API_KEY).toBeUndefined()
    expect(result.authJson.google).toBeUndefined()
    expect(result.authJson.openai).toBeUndefined()
    expect(result.authJson["github-copilot"]).toEqual({
      type: "oauth",
      credentials: { token: "copilot" },
    })
  })

  it("keeps Secrets-eligible keys as plaintext when Daytona Secrets are unavailable", () => {
    const result = buildPlaintextSandboxCredentials(
      new Map([
        ["google", "gem-secret"],
        ["openai", "oai-secret"],
      ])
    )

    expect(result.envVars.GEMINI_API_KEY).toBe("gem-secret")
    expect(result.envVars.OPENAI_API_KEY).toBe("oai-secret")
  })

  it("keeps OCC base URL and model as plain env config", () => {
    const result = buildPlaintextSandboxCredentials(
      new Map([
        ["openai-chat-completions", "occ-key"],
        ["openai-chat-completions-base-url", "https://api.example.com/v1"],
        ["openai-chat-completions-model", "my-model"],
      ])
    )

    expect(result.envVars.OPENAI_CHAT_COMPLETIONS_API_KEY).toBe("occ-key")
    expect(result.authJson["openai-chat-completions"]).toEqual({
      type: "api_key",
      key: "occ-key",
    })
    expect(result.envVars.OPENAI_CHAT_COMPLETIONS_BASE_URL).toBe(
      "https://api.example.com/v1"
    )
    expect(result.envVars.OPENAI_CHAT_COMPLETIONS_MODEL).toBe("my-model")
  })
})
