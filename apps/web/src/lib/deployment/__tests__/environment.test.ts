import { afterEach, describe, expect, it, vi } from "vitest"
import { isCloudflareDeployment, isHostedDeployment } from "../environment"

describe("deployment environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("treats Cloudflare Workers as a hosted deployment", () => {
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "cloudflare")
    expect(isCloudflareDeployment()).toBe(true)
    expect(isHostedDeployment()).toBe(true)
  })

  it("is local without FLEET_PI_DEPLOYMENT", () => {
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "")
    expect(isCloudflareDeployment()).toBe(false)
    expect(isHostedDeployment()).toBe(false)
  })
})
