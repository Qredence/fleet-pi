import { describe, expect, it } from "vitest"
import {
  assertSafeOpenAiCompatibleBaseUrl,
  normalizeOpenAiCompatibleBaseUrl,
} from "../openai-chat-completions-provider"
import { sanitizeProviderCredentialValue } from "@/lib/env-manager"

describe("openai chat completions credential helpers", () => {
  it("normalizes pasted chat-completions URLs to the API root", () => {
    expect(
      normalizeOpenAiCompatibleBaseUrl(
        "https://opencode.ai/zen/v1/chat/completions"
      )
    ).toBe("https://opencode.ai/zen/v1")
    expect(
      normalizeOpenAiCompatibleBaseUrl("https://opencode.ai/zen/v1/")
    ).toBe("https://opencode.ai/zen/v1")
  })

  it("strips wrapping and trailing quote corruption from secrets", () => {
    expect(sanitizeProviderCredentialValue("  sk-abc'  ")).toBe("sk-abc")
    expect(sanitizeProviderCredentialValue('"sk-abc"')).toBe("sk-abc")
    expect(sanitizeProviderCredentialValue("deepseek-v4-flash-free")).toBe(
      "deepseek-v4-flash-free"
    )
  })

  it("allows public https endpoints and blocks private SSRF targets", () => {
    expect(
      assertSafeOpenAiCompatibleBaseUrl(
        "https://opencode.ai/zen/v1/chat/completions"
      )
    ).toBe("https://opencode.ai/zen/v1")

    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("http://169.254.169.254/latest")
    ).toThrow(/https|not allowed/i)

    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://192.168.1.10/v1")
    ).toThrow(/not allowed/i)

    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://metadata.google.internal/")
    ).toThrow(/not allowed/i)
  })
})
