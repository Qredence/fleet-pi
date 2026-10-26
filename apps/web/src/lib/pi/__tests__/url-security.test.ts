import { describe, expect, it } from "vitest"
import {
  isPrivateNetworkAddress,
  validatePublicHttpsUrl,
} from "../../../../../../.pi/extensions/lib/url-security"
import {
  assertSafeCustomProviderBaseUrl,
  assertSafeOpenAiCompatibleBaseUrl,
  isLoopbackHostname,
} from "../runtime/openai-chat-completions-url"

describe("public URL security", () => {
  it("rejects loopback, private, and metadata destinations", async () => {
    await expect(
      validatePublicHttpsUrl("http://localhost:3000")
    ).rejects.toThrow()
    await expect(
      validatePublicHttpsUrl("https://127.0.0.1/internal")
    ).rejects.toThrow()
    await expect(
      validatePublicHttpsUrl("https://169.254.169.254/latest/meta-data")
    ).rejects.toThrow()
    await expect(validatePublicHttpsUrl("https://[::1]/")).rejects.toThrow()
  })

  it("requires HTTPS for every fetch target", async () => {
    await expect(validatePublicHttpsUrl("http://example.com")).rejects.toThrow(
      "must use https://"
    )
  })

  it("blocks mapped IPv4 and link-local/private ranges", () => {
    expect(isPrivateNetworkAddress("::ffff:192.168.1.10")).toBe(true)
    expect(isPrivateNetworkAddress("169.254.169.254")).toBe(true)
    expect(isPrivateNetworkAddress("fe80::1")).toBe(true)
    expect(isPrivateNetworkAddress("93.184.216.34")).toBe(false)
  })

  it("blocks IPv4-mapped IPv6 private and metadata hosts in custom provider base URLs", () => {
    expect(isLoopbackHostname("[::ffff:127.0.0.1]")).toBe(true)
    expect(isLoopbackHostname("[::ffff:7f00:1]")).toBe(true)
    expect(() =>
      assertSafeOpenAiCompatibleBaseUrl("https://[::ffff:169.254.169.254]/v1")
    ).toThrow(/host is not allowed/)
    expect(() =>
      assertSafeCustomProviderBaseUrl("https://[::ffff:10.0.0.1]/v1")
    ).toThrow(/host is not allowed/)
    expect(() =>
      assertSafeCustomProviderBaseUrl("https://[::ffff:192.168.1.1]/v1")
    ).toThrow(/host is not allowed/)
    expect(
      assertSafeCustomProviderBaseUrl("https://[::ffff:93.184.216.34]/v1")
    ).toBe("https://[::ffff:5db8:d822]/v1")
  })
})
