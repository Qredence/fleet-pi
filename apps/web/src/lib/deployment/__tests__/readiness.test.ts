import { describe, expect, it } from "vitest"
import { TEST_NEON_AI_GATEWAY_BASE_URL } from "../../pi/runtime/__tests__/gateway-test-fixtures"
import { validateDeploymentReadiness } from "../readiness"

const testGatewayEnv = {
  NEON_AI_GATEWAY_TOKEN: "nt_live_test",
  NEON_AI_GATEWAY_BASE_URL: TEST_NEON_AI_GATEWAY_BASE_URL,
} as const

describe("validateDeploymentReadiness", () => {
  it("passes in local mode without hosted env vars", () => {
    const result = validateDeploymentReadiness({
      trustZone: "local",
      env: {},
    })

    expect(result.ok).toBe(true)
    expect(result.checks.some((check) => check.id === "local-mode")).toBe(true)
  })

  it("requires core auth and chat database env vars on Cloudflare production", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-production",
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

  it("requires preview chat URL distinct from production on Cloudflare preview", () => {
    const productionChat = "postgres://prod-neon-host/production-chat"
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-preview",
      env: {
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://preview.example",
        FLEET_PI_CHAT_DATABASE_URL: productionChat,
        FLEET_PI_PRODUCTION_CHAT_DATABASE_URL: productionChat,
        BETTER_AUTH_TRUSTED_ORIGINS: "https://preview.example",
        FLEET_PI_DEPLOYMENT_TRUST_ZONE: "preview",
        FLEET_PI_PREVIEW_DATABASE_MARKER: "preview-neon",
        FLEET_PI_PRODUCTION_DATABASE_MARKER: "prod-neon",
        ...testGatewayEnv,
      },
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find(
        (check) => check.id === "preview:chat-url-not-production"
      )?.ok
    ).toBe(false)
  })

  it("requires preview trust-zone markers on Cloudflare preview", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-preview",
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
      trustZone: "cloudflare-preview",
      env: {
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://preview.example",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://preview-neon-host/preview-auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://preview-neon-host/preview-chat",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://preview.example",
        FLEET_PI_DEPLOYMENT_TRUST_ZONE: "preview",
        FLEET_PI_PREVIEW_DATABASE_MARKER: "preview-neon",
        FLEET_PI_PRODUCTION_DATABASE_MARKER: "prod-neon",
        ...testGatewayEnv,
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
        "20260719_pi_rls_initplan",
        "20260723_revoke_data_api_pi_grants_again",
        "20260723_pi_force_row_level_security",
        "20260725_db_optimization",
        "20260803_drop_unused_indexes",
      ],
      piSessionsRlsEnabled: true,
      piSessionsForceRls: true,
      ownershipProbePresent: true,
      dataApiPiPrivileges: [],
    })

    expect(result.ok).toBe(true)
  })

  it("requires Neon AI Gateway env on Cloudflare", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-production",
      env: {
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://app.example",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://chat",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example",
      },
    })

    expect(
      result.checks.find((check) => check.id === "env:NEON_AI_GATEWAY_TOKEN")
        ?.ok
    ).toBe(false)
    expect(
      result.checks.find((check) => check.id === "env:NEON_AI_GATEWAY_BASE_URL")
        ?.ok
    ).toBe(false)
  })

  it("requires BETTER_AUTH_URL on preview", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-preview",
      env: {
        BETTER_AUTH_SECRET: "secret",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://preview-neon-host/preview-auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://preview-neon-host/preview-chat",
        BETTER_AUTH_TRUSTED_ORIGINS:
          "https://pr-1.fleet-pi-web.example.workers.dev",
        FLEET_PI_DEPLOYMENT_TRUST_ZONE: "preview",
        FLEET_PI_PREVIEW_DATABASE_MARKER: "preview-neon",
        FLEET_PI_PRODUCTION_DATABASE_MARKER: "prod-neon",
        ...testGatewayEnv,
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
        "20260719_pi_rls_initplan",
        "20260723_revoke_data_api_pi_grants_again",
        "20260723_pi_force_row_level_security",
        "20260725_db_optimization",
        "20260803_drop_unused_indexes",
      ],
      piSessionsRlsEnabled: true,
      piSessionsForceRls: true,
      ownershipProbePresent: true,
      dataApiPiPrivileges: [],
    })

    expect(
      result.checks.find((check) => check.id === "env:BETTER_AUTH_URL")?.ok
    ).toBe(false)
    expect(result.ok).toBe(false)
  })

  it("fails when Data API roles still hold privileges on critical pi_* tables", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-production",
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

  it("fails readiness when dual-host chat has an empty CORS allowlist", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-production",
      env: {
        NEON_AUTH_BASE_URL: "https://auth.example",
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        NEON_AUTH_ISSUER: "https://auth.example",
        NEON_AUTH_JWKS_URL: "https://auth.example/.well-known/jwks.json",
        VITE_NEON_AUTH_URL: "https://auth.example",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://chat",
        VITE_FLEET_PI_CHAT_RUNTIME_URL: "https://function.example",
        FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS: "",
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://app.example",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example",
        ...testGatewayEnv,
      },
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find(
        (check) => check.id === "env:FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS"
      )?.ok
    ).toBe(false)
  })

  it("fails when NEON_AUTH_JWKS_URL is empty under Managed Auth", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-production",
      env: {
        NEON_AUTH_BASE_URL: "https://auth.example",
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        NEON_AUTH_ISSUER: "https://auth.example",
        VITE_NEON_AUTH_URL: "https://auth.example",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://chat",
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://app.example",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example",
        ...testGatewayEnv,
      },
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find((check) => check.id === "env:NEON_AUTH_JWKS_URL")?.ok
    ).toBe(false)
  })

  it("fails when a Data API role can EXECUTE the ownership probe", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-production",
      env: {
        NEON_AUTH_BASE_URL: "https://auth.example",
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        NEON_AUTH_ISSUER: "https://auth.example",
        NEON_AUTH_JWKS_URL: "https://auth.example/.well-known/jwks.json",
        VITE_NEON_AUTH_URL: "https://auth.example",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://chat",
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://app.example",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example",
        ...testGatewayEnv,
      },
      ownershipProbeDataApiExecute: ["authenticated"],
    })

    expect(result.ok).toBe(false)
    expect(
      result.checks.find(
        (check) => check.id === "db:ownership-probe-execute-revoked"
      )?.ok
    ).toBe(false)
  })

  it("requires NEON_AUTH_ISSUER when Neon Managed Auth is configured", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-production",
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
      trustZone: "cloudflare-preview",
      env: {
        BETTER_AUTH_SECRET: "secret",
        BETTER_AUTH_URL: "https://preview.example",
        FLEET_PI_AUTH_DATABASE_URL: "postgres://preview-auth",
        FLEET_PI_CHAT_DATABASE_URL: "postgres://preview-chat",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://preview.example",
        FLEET_PI_DEPLOYMENT_TRUST_ZONE: "preview",
        FLEET_PI_PREVIEW_DATABASE_MARKER: "preview-neon",
        FLEET_PI_PRODUCTION_DATABASE_MARKER: "prod-neon",
        ...testGatewayEnv,
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
      trustZone: "cloudflare-preview",
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

  it("fails when the ownership probe no longer returns deleted", () => {
    const result = validateDeploymentReadiness({
      trustZone: "cloudflare-production",
      env: {
        FLEET_PI_CHAT_DATABASE_URL: "postgres://chat",
        NEON_AUTH_BASE_URL: "https://auth.example",
        NEON_AUTH_COOKIE_SECRET: "cookie-secret",
        NEON_AI_GATEWAY_TOKEN: "token",
        NEON_AI_GATEWAY_BASE_URL: "https://gateway.neon.tech/v1",
      },
      ownershipProbeRecognizesDeleted: false,
      chatRuntimeBypassesRls: true,
      chatRuntimeRoleName: "neondb_owner",
    })

    expect(
      result.checks.find((check) => check.id === "db:ownership-probe-deleted")
        ?.ok
    ).toBe(false)
    expect(
      result.checks.find((check) => check.id === "db:chat-runtime-role")?.ok
    ).toBe(false)
  })
})
