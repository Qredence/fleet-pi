import { describe, expect, it } from "vitest"
import {
  VERCEL_AUTH_HOSTS,
  resolveTrustedOriginsForDeployment,
  resolveVercelAllowedHosts,
} from "../auth-host-policy"

describe("auth-host-policy", () => {
  it("does not include a wildcard vercel.app host", () => {
    expect(VERCEL_AUTH_HOSTS).not.toContain("*.vercel.app")
    expect(resolveVercelAllowedHosts("https://preview.example")).not.toContain(
      "*.vercel.app"
    )
  })

  it("locks preview trusted origins to BETTER_AUTH_URL when unset", () => {
    expect(
      resolveTrustedOriginsForDeployment({
        isVercel: true,
        isPreview: true,
        configuredOrigins: [],
        betterAuthUrl: "https://preview.example",
      })
    ).toEqual(["https://preview.example"])
  })

  it("falls back to VERCEL_URL for preview trusted origins", () => {
    expect(
      resolveTrustedOriginsForDeployment({
        isVercel: true,
        isPreview: true,
        configuredOrigins: [],
        vercelUrl: "fleet-pi-web-git-branch-qredence.vercel.app",
      })
    ).toEqual(["https://fleet-pi-web-git-branch-qredence.vercel.app"])
  })

  it("includes VERCEL_URL host in allowed preview hosts", () => {
    expect(
      resolveVercelAllowedHosts(
        undefined,
        "fleet-pi-web-git-branch-qredence.vercel.app"
      )
    ).toContain("fleet-pi-web-git-branch-qredence.vercel.app")
  })

  it("requires preview BETTER_AUTH_URL when trusted origins are unset", () => {
    expect(() =>
      resolveTrustedOriginsForDeployment({
        isVercel: true,
        isPreview: true,
        configuredOrigins: [],
      })
    ).toThrow(/BETTER_AUTH_URL is required/)
  })
})
