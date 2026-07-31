import { describe, expect, it } from "vitest"
import {
  assertSafeOpenAiCompatibleBaseUrl,
  isAllowedNeonAiGatewayHostname,
  normalizeOpenAiCompatibleBaseUrl,
} from "../openai-chat-completions-url"
import { TEST_NEON_AI_GATEWAY_HOST } from "./gateway-test-fixtures"
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

  it("blocks IPv6 ULA + link-local but not public hostnames sharing those nibbles", () => {
    // Link-local fe80::/10 across the whole fe80..febf range.
    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://[fe80::1]/v1")
    ).toThrow(/not allowed/i)
    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://[fe90::1]/v1")
    ).toThrow(/not allowed/i)
    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://[feb5::1]/v1")
    ).toThrow(/not allowed/i)
    // Unique-local fc00::/7.
    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://[fd00::1]/v1")
    ).toThrow(/not allowed/i)
    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://[fc12:ab::1]/v1")
    ).toThrow(/not allowed/i)

    // Loopback is allowed off-Vercel (local dev only) and is parsed as IPv6, not
    // mistaken for a public/private-block edge.
    expect(assertSafeOpenAiCompatibleBaseUrl("https://[::1]/v1")).toBe(
      "https://[::1]/v1"
    )

    // Public hostnames that merely start with fc/fd/fe80* characters are allowed.
    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://fd.example.com/v1")
    ).not.toThrow()
    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://fe80.example.com/v1")
    ).not.toThrow()
  })

  it("allows only neon.tech gateway hosts", () => {
    expect(isAllowedNeonAiGatewayHostname(TEST_NEON_AI_GATEWAY_HOST)).toBe(true)
    expect(isAllowedNeonAiGatewayHostname("evil.example.com")).toBe(false)
  })
})
