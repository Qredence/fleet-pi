import { describe, expect, it } from "vitest"
import { isPrivateNetworkAddress } from "../../../../../.pi/extensions/lib/url-security"

describe("url security helpers", () => {
  it("detects private and internal network addresses", () => {
    expect(isPrivateNetworkAddress("127.0.0.1")).toBe(true)
    expect(isPrivateNetworkAddress("10.0.0.4")).toBe(true)
    expect(isPrivateNetworkAddress("172.20.5.8")).toBe(true)
    expect(isPrivateNetworkAddress("192.168.1.8")).toBe(true)
    expect(isPrivateNetworkAddress("169.254.10.20")).toBe(true)
    expect(isPrivateNetworkAddress("::1")).toBe(true)
    expect(isPrivateNetworkAddress("fd00::1")).toBe(true)
    expect(isPrivateNetworkAddress("fe80::1")).toBe(true)
    expect(isPrivateNetworkAddress("::ffff:127.0.0.1")).toBe(true)
  })

  it("allows public IP addresses", () => {
    expect(isPrivateNetworkAddress("8.8.8.8")).toBe(false)
    expect(isPrivateNetworkAddress("1.1.1.1")).toBe(false)
    expect(isPrivateNetworkAddress("2606:4700:4700::1111")).toBe(false)
  })
})
