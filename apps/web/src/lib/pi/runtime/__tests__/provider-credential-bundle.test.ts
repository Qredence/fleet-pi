import { describe, expect, it } from "vitest"
import { OPENAI_CHAT_COMPLETIONS_PROVIDER_ID } from "@workspace/pi-protocol/provider-catalog"
import {
  isRemovableCredentialProvider,
  resolveProviderCredentialBundle,
} from "../provider-credential-bundle"

describe("provider-credential-bundle", () => {
  it("includes OpenAI Chat Completions companion ids when removing OCC", () => {
    const bundle = resolveProviderCredentialBundle(
      OPENAI_CHAT_COMPLETIONS_PROVIDER_ID
    )
    expect(bundle.providerIds).toEqual([
      "openai-chat-completions",
      "openai-chat-completions-base-url",
      "openai-chat-completions-model",
    ])
    expect(bundle.envVarNames).toEqual([
      "OPENAI_CHAT_COMPLETIONS_API_KEY",
      "OPENAI_CHAT_COMPLETIONS_BASE_URL",
      "OPENAI_CHAT_COMPLETIONS_MODEL",
    ])
  })

  it("allows removing credential UI providers only", () => {
    expect(isRemovableCredentialProvider("google")).toBe(true)
    expect(isRemovableCredentialProvider("github-copilot")).toBe(false)
    expect(isRemovableCredentialProvider("daytona")).toBe(false)
  })
})
