import { describe, expect, it } from "vitest"
import { validateDeploymentReadiness } from "../readiness"

describe("validateDeploymentReadiness", () => {
  it("passes in local mode without Vercel env vars", () => {
    const result = validateDeploymentReadiness({
      trustZone: "local",
      env: {},
    })

    expect(result.ok).toBe(true)
    expect(result.checks.some((check) => check.id === "local-mode")).toBe(true)
  })

  it("requires core auth and chat database env vars on Vercel production", () => {
    const result = validateDeploymentReadiness({
      trustZone: "vercel-production",
      env: {},
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find((check) => check.id === "env:BETTER_AUTH_SECRET")?.ok
    ).toBe(false)
    expect(
      result.checks.find(
        (check) => check.id === "env:FLEET_PI_CHAT_DATABASE_URL"
      )?.ok
    ).toBe(false)
  })

  it("requires preview trust-zone markers on Vercel preview", () => {
    const result = validateDeploymentReadiness({
      trustZone: "vercel-preview",
      env: {
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://preview.example",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://preview-auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://preview-chat",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://preview.example",
      },
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find((check) => check.id === "preview:trust-zone")?.ok
    ).toBe(false)
  })

  it("passes when preview markers and migrations are present", () => {
    const result = validateDeploymentReadiness({
      trustZone: "vercel-preview",
      env: {
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://preview.example",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://preview-neon-host/preview-auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://preview-neon-host/preview-chat",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://preview.example",
        FLEET_PI_DEPLOYMENT_TRUST_ZONE: "preview",
        FLEET_PI_PREVIEW_DATABASE_MARKER: "preview-neon",
        FLEET_PI_PRODUCTION_DATABASE_MARKER: "prod-neon",
      },
      authTablesRlsDisabled: true,
      chatMigrationsApplied: [
        "20260614_pi_session_mirror_all_rls",
        "20260709_pi_sessions_rls_strict",
        "20260710_pi_session_ownership_probe",
      ],
      piSessionsRlsEnabled: true,
      ownershipProbePresent: true,
    })

    expect(result.ok).toBe(true)
  })

  it("fails when preview database URLs omit the preview marker", () => {
    const result = validateDeploymentReadiness({
      trustZone: "vercel-preview",
      env: {
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://preview.example",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://preview-auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://preview-chat",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://preview.example",
        FLEET_PI_DEPLOYMENT_TRUST_ZONE: "preview",
        FLEET_PI_PREVIEW_DATABASE_MARKER: "preview-neon",
        FLEET_PI_PRODUCTION_DATABASE_MARKER: "prod-neon",
      },
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find((check) => check.id === "preview:chat-url-marker")?.ok
    ).toBe(false)
    expect(
      result.checks.find((check) => check.id === "preview:auth-url-marker")?.ok
    ).toBe(false)
  })

  it("fails when preview chat URL matches production companion URL", () => {
    const result = validateDeploymentReadiness({
      trustZone: "vercel-preview",
      env: {
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://preview.example",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://preview-neon-host/preview-auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://prod-neon-host/prod-chat",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://preview.example",
        FLEET_PI_DEPLOYMENT_TRUST_ZONE: "preview",
        FLEET_PI_PREVIEW_DATABASE_MARKER: "preview-neon",
        FLEET_PI_PRODUCTION_DATABASE_MARKER: "prod-neon",
        FLEET_PI_PRODUCTION_CHAT_DATABASE_URL:
          "postgres://prod-neon-host/prod-chat",
      },
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find(
        (check) => check.id === "preview:chat-url-not-production"
      )?.ok
    ).toBe(false)
  })
})
