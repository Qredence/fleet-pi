import { describe, expect, it } from "vitest"
import {
  daytonaSecretName,
  isDaytonaSecretsEligibleProvider,
  resolveDaytonaSecretHosts,
} from "./secret-hosts"

describe("secret-hosts", () => {
  it("names secrets with a fleet_pi prefix", () => {
    expect(daytonaSecretName("google")).toBe("fleet_pi_google")
    expect(daytonaSecretName("openai-chat-completions")).toBe(
      "fleet_pi_openai-chat-completions"
    )
  })

  it("resolves static hosts for common API-key providers", () => {
    expect(resolveDaytonaSecretHosts("openai")).toEqual(["api.openai.com"])
    expect(resolveDaytonaSecretHosts("anthropic")).toEqual([
      "api.anthropic.com",
    ])
    expect(resolveDaytonaSecretHosts("google")).toEqual([
      "generativelanguage.googleapis.com",
    ])
  })

  it("excludes oauth, ADC, bedrock, ollama, and infra", () => {
    expect(resolveDaytonaSecretHosts("github-copilot")).toBeUndefined()
    expect(resolveDaytonaSecretHosts("google-vertex")).toBeUndefined()
    expect(resolveDaytonaSecretHosts("amazon-bedrock")).toBeUndefined()
    expect(resolveDaytonaSecretHosts("ollama")).toBeUndefined()
    expect(resolveDaytonaSecretHosts("daytona")).toBeUndefined()
  })

  it("derives OCC hosts from HTTPS base URL only", () => {
    expect(
      resolveDaytonaSecretHosts("openai-chat-completions", {
        occBaseUrl: "https://api.example.com/v1",
      })
    ).toEqual(["api.example.com"])

    expect(
      resolveDaytonaSecretHosts("openai-chat-completions", {
        occBaseUrl: "http://localhost:8080",
      })
    ).toBeUndefined()

    expect(resolveDaytonaSecretHosts("openai-chat-completions")).toBeUndefined()
  })

  it("marks providers as Secrets-eligible only when hosts resolve", () => {
    expect(
      isDaytonaSecretsEligibleProvider({ id: "google", authType: "apiKey" })
    ).toBe(true)
    expect(
      isDaytonaSecretsEligibleProvider({
        id: "github-copilot",
        authType: "oauth",
      })
    ).toBe(false)
    expect(
      isDaytonaSecretsEligibleProvider(
        { id: "openai-chat-completions" },
        { occBaseUrl: "https://proxy.example.com" }
      )
    ).toBe(true)
  })
})
