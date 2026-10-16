import { describe, expect, it } from "vitest"
import {
  HOSTED_AUTH_HOSTS,
  resolveHostedAllowedHosts,
  resolveTrustedOriginsForDeployment,
} from "../auth-host-policy"

describe("auth-host-policy", () => {
  it("does not include a wildcard host", () => {
    expect(HOSTED_AUTH_HOSTS).not.toContain("*.workers.dev")
    expect(resolveHostedAllowedHosts("https://preview.example")).not.toContain(
      "*.workers.dev"
    )
  })

  it("locks preview trusted origins to BETTER_AUTH_URL", () => {
    expect(
      resolveTrustedOriginsForDeployment({
        isHosted: true,
        isPreview: true,
        configuredOrigins: [],
        betterAuthUrl: "https://preview.example",
      })
    ).toEqual(["https://preview.example"])
  })

  it("includes the configured base URL host in allowed hosts", () => {
    expect(
      resolveHostedAllowedHosts("https://fleet-pi-web.example.workers.dev")
    ).toContain("fleet-pi-web.example.workers.dev")
  })

  it("requires preview BETTER_AUTH_URL when trusted origins are unset", () => {
    expect(() =>
      resolveTrustedOriginsForDeployment({
        isHosted: true,
        isPreview: true,
        configuredOrigins: [],
      })
    ).toThrow(/BETTER_AUTH_URL is required/)
  })
})
