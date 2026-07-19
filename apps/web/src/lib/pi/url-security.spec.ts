import { describe, expect, it } from "vitest"
import {
  isPrivateNetworkAddress,
  validatePublicHttpsUrl,
} from "../../../../../.pi/extensions/lib/url-security"

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
})
