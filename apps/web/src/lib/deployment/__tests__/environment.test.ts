import { afterEach, describe, expect, it, vi } from "vitest"
import { isCloudflareDeployment, isVercelDeployment } from "../environment"

describe("deployment environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("treats Cloudflare Workers as a hosted deployment", () => {
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "cloudflare")
    expect(isCloudflareDeployment()).toBe(true)
    expect(isVercelDeployment()).toBe(true)
  })

  it("is local without VERCEL or FLEET_PI_DEPLOYMENT", () => {
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "")
    expect(isCloudflareDeployment()).toBe(false)
    expect(isVercelDeployment()).toBe(false)
  })
})
