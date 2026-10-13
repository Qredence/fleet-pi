import { afterEach, describe, expect, it } from "vitest"
import { assertDeploymentReadyOnBoot } from "../boot-check"

describe("assertDeploymentReadyOnBoot", () => {
  const originalFleetDeployment = process.env.FLEET_PI_DEPLOYMENT
  const originalSecret = process.env.BETTER_AUTH_SECRET
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches")

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET
    } else {
      process.env.BETTER_AUTH_SECRET = originalSecret
    }
    if (originalFleetDeployment === undefined) {
      delete process.env.FLEET_PI_DEPLOYMENT
    } else {
      process.env.FLEET_PI_DEPLOYMENT = originalFleetDeployment
    }
    if (originalCaches) {
      Object.defineProperty(globalThis, "caches", originalCaches)
    } else {
      delete (globalThis as { caches?: unknown }).caches
    }
  })

  it("does not throw outside Cloudflare", () => {
    delete process.env.FLEET_PI_DEPLOYMENT

    expect(() => assertDeploymentReadyOnBoot()).not.toThrow()
  })

  it("does not throw on Cloudflare when the Worker caches global is absent", () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    delete process.env.BETTER_AUTH_SECRET
    delete (globalThis as { caches?: unknown }).caches

    expect(() => assertDeploymentReadyOnBoot()).not.toThrow()
  })

  it("throws on Cloudflare Worker runtime when required env vars are missing", () => {
    process.env.FLEET_PI_DEPLOYMENT = "cloudflare"
    delete process.env.BETTER_AUTH_SECRET
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: {},
    })

    expect(() => assertDeploymentReadyOnBoot()).toThrow(
      /Deployment readiness check failed/
    )
  })
})
