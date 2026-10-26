import { afterEach, describe, expect, it, vi } from "vitest"
import {
  requiresAuthenticatedMirrorOwner,
  resolveDeploymentTrustZone,
  shouldFailClosedOnFunctionMirrorWrite,
  shouldFailClosedOnMirrorError,
} from "../trust-zone"

describe("resolveDeploymentTrustZone", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns cloudflare-preview when deployment trust zone is preview", () => {
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "cloudflare")
    vi.stubEnv("FLEET_PI_DEPLOYMENT_TRUST_ZONE", "preview")
    expect(resolveDeploymentTrustZone()).toBe("cloudflare-preview")
  })

  it("returns cloudflare-production for default Cloudflare vars", () => {
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "cloudflare")
    vi.stubEnv("FLEET_PI_DEPLOYMENT_TRUST_ZONE", "")
    expect(resolveDeploymentTrustZone()).toBe("cloudflare-production")
  })
})

describe("shouldFailClosedOnMirrorError", () => {
  it("fails open locally without Neon Auth", () => {
    expect(shouldFailClosedOnMirrorError({})).toBe(false)
    expect(requiresAuthenticatedMirrorOwner({})).toBe(false)
  })

  it("fails closed on Cloudflare", () => {
    expect(
      shouldFailClosedOnMirrorError({ FLEET_PI_DEPLOYMENT: "cloudflare" })
    ).toBe(true)
  })

  it("fails closed when Neon Managed Auth is configured", () => {
    expect(
      shouldFailClosedOnMirrorError({
        NEON_AUTH_BASE_URL: "https://auth.example",
      })
    ).toBe(true)
  })
})

describe("shouldFailClosedOnFunctionMirrorWrite", () => {
  it("fails the turn on Cloudflare", () => {
    expect(shouldFailClosedOnFunctionMirrorWrite({})).toBe(false)
    expect(
      shouldFailClosedOnFunctionMirrorWrite({
        FLEET_PI_DEPLOYMENT: "cloudflare",
      })
    ).toBe(true)
  })
})
