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
        "20260711_pi_session_tombstones",
        "20260711_pi_user_providers_auth_type",
        "20260718_pi_user_settings",
        "20260719_revoke_data_api_pi_grants",
        "20260719_revoke_ownership_probe_execute",
        "20260723_revoke_data_api_pi_grants_again",
        "20260723_pi_force_row_level_security",
      ],
      piSessionsRlsEnabled: true,
      piSessionsForceRls: true,
      ownershipProbePresent: true,
      dataApiPiPrivileges: [],
    })

    expect(result.ok).toBe(true)
  })

  it("accepts VERCEL_URL as preview auth URL fallback", () => {
    const result = validateDeploymentReadiness({
      trustZone: "vercel-preview",
      env: {
        BETTER_AUTH_SECRET: "secret",
        VERCEL_URL: "fleet-pi-web-git-branch-qredence.vercel.app",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://preview-neon-host/preview-auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://preview-neon-host/preview-chat",
        BETTER_AUTH_TRUSTED_ORIGINS:
          "https://fleet-pi-web-git-branch-qredence.vercel.app",
        FLEET_PI_DEPLOYMENT_TRUST_ZONE: "preview",
        FLEET_PI_PREVIEW_DATABASE_MARKER: "preview-neon",
        FLEET_PI_PRODUCTION_DATABASE_MARKER: "prod-neon",
      },
      authTablesRlsDisabled: true,
      chatMigrationsApplied: [
        "20260614_pi_session_mirror_all_rls",
        "20260709_pi_sessions_rls_strict",
        "20260710_pi_session_ownership_probe",
        "20260711_pi_session_tombstones",
        "20260711_pi_user_providers_auth_type",
        "20260718_pi_user_settings",
        "20260719_revoke_data_api_pi_grants",
        "20260719_revoke_ownership_probe_execute",
        "20260723_revoke_data_api_pi_grants_again",
        "20260723_pi_force_row_level_security",
      ],
      piSessionsRlsEnabled: true,
      piSessionsForceRls: true,
      ownershipProbePresent: true,
      dataApiPiPrivileges: [],
    })

    expect(
      result.checks.find((check) => check.id === "env:BETTER_AUTH_URL")?.ok
    ).toBe(true)
    expect(result.ok).toBe(true)
  })

  it("fails when Data API roles still hold privileges on critical pi_* tables", () => {
    const result = validateDeploymentReadiness({
      trustZone: "vercel-production",
      env: {
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://app.example",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://chat",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example",
      },
      dataApiPiPrivileges: [
        {
          tableName: "pi_user_settings",
          grantee: "authenticated",
          privilegeType: "SELECT",
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find(
        (check) => check.id === "db:data-api-pi-grants-revoked"
      )?.ok
    ).toBe(false)
  })

  it("requires NEON_AUTH_ISSUER when Neon Managed Auth is configured", () => {
    const result = validateDeploymentReadiness({
      trustZone: "vercel-production",
      env: {
        NEON_AUTH_URL: "https://auth.example",
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        VITE_NEON_AUTH_URL: "https://auth.example",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://chat",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example",
      },
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find((check) => check.id === "env:NEON_AUTH_ISSUER")?.ok
    ).toBe(false)
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
