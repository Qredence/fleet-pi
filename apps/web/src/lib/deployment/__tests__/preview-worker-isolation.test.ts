// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { describe, expect, it } from "vitest"
import { runChatMigrations } from "../../db/chat-migrations"
import {
  PreviewWorkerIsolationError,
  assertPreviewAuthBaseUrl,
  assertPreviewChatDatabaseUrl,
  assertPreviewSecretAllowlist,
  buildPreviewWorkerSecrets,
  findDisallowedPreviewSecretNames,
  postgresConnectionIdentitiesEqual,
} from "../preview-worker-isolation"
import type { ChatMigrationClient } from "../../db/chat-migrations"

const PRODUCTION_CHAT_URL =
  "postgresql://fleet_pi_app:prod@ep-prod.aws.neon.tech/neondb?sslmode=require"
const PREVIEW_CHAT_URL =
  "postgresql://fleet_pi_app:preview@ep-preview.aws.neon.tech/neondb?sslmode=require"

function clientFor(db: PGlite): ChatMigrationClient {
  return {
    query: async <T>(text: string, params?: Array<unknown>) => {
      if (params && params.length > 0) {
        const result = await db.query<T>(text, params)
        return { rows: result.rows }
      }
      const results = await db.exec(text)
      return { rows: (results.at(-1)?.rows ?? []) as Array<T> }
    },
  }
}

async function bootstrapSessionsTable(db: PGlite) {
  await db.exec(`CREATE ROLE fleet_pi_app NOLOGIN;`)
  await runChatMigrations(clientFor(db), () => {})
}

describe("preview-worker-isolation", () => {
  it("refuses missing or production-equal preview database URLs", () => {
    expect(() => assertPreviewChatDatabaseUrl("", PRODUCTION_CHAT_URL)).toThrow(
      PreviewWorkerIsolationError
    )
    expect(() => assertPreviewChatDatabaseUrl(PREVIEW_CHAT_URL, "")).toThrow(
      /FLEET_PI_PRODUCTION_CHAT_DATABASE_URL/
    )
    expect(() =>
      assertPreviewChatDatabaseUrl(PRODUCTION_CHAT_URL, PRODUCTION_CHAT_URL)
    ).toThrow(/must not match production/)
    expect(() =>
      assertPreviewChatDatabaseUrl(
        "postgresql://fleet_pi_app:x@ep-prod.aws.neon.tech/neondb",
        PRODUCTION_CHAT_URL
      )
    ).toThrow(/must not match production/)
    expect(() =>
      assertPreviewChatDatabaseUrl(PREVIEW_CHAT_URL, PRODUCTION_CHAT_URL)
    ).not.toThrow()
  })

  it("compares postgres identities by host, database, and role", () => {
    expect(
      postgresConnectionIdentitiesEqual(
        "postgresql://fleet_pi_app:aaa@host/db",
        "postgresql://fleet_pi_app:bbb@host/db"
      )
    ).toBe(true)
    expect(
      postgresConnectionIdentitiesEqual(
        "postgresql://neondb_owner@host/db",
        "postgresql://fleet_pi_app@host/db"
      )
    ).toBe(false)
  })

  it("treats Neon direct and pooler hostnames as the same database", () => {
    const direct =
      "postgresql://fleet_pi_app:prod@ep-prod.us-east-2.aws.neon.tech/neondb"
    const pooled =
      "postgresql://fleet_pi_app:prod@ep-prod-pooler.us-east-2.aws.neon.tech/neondb"
    expect(postgresConnectionIdentitiesEqual(direct, pooled)).toBe(true)
    expect(() =>
      assertPreviewChatDatabaseUrl(PREVIEW_CHAT_URL, direct)
    ).not.toThrow()
    expect(() => assertPreviewChatDatabaseUrl(direct, direct)).toThrow(
      /must not match production/
    )
    expect(() => assertPreviewChatDatabaseUrl(pooled, direct)).toThrow(
      /must not match production/
    )
  })

  it("normalizes auth base URLs before comparing preview and production", () => {
    expect(() =>
      assertPreviewAuthBaseUrl(
        "https://auth.preview.example/",
        "https://auth.preview.example"
      )
    ).toThrow(PreviewWorkerIsolationError)
    expect(() =>
      assertPreviewAuthBaseUrl(
        "https://AUTH.PREVIEW.EXAMPLE",
        "https://auth.prod.example"
      )
    ).not.toThrow()
  })

  it("rejects production auth base URLs and non-allowlisted secret names", () => {
    expect(() =>
      assertPreviewAuthBaseUrl(
        "https://auth.prod.example",
        "https://auth.prod.example"
      )
    ).toThrow(PreviewWorkerIsolationError)

    expect(
      findDisallowedPreviewSecretNames([
        "FLEET_PI_CHAT_DATABASE_URL",
        "DAYTONA_API_KEY",
        "OPENAI_API_KEY",
      ])
    ).toEqual(["DAYTONA_API_KEY", "OPENAI_API_KEY"])

    expect(() =>
      buildPreviewWorkerSecrets({
        previewChatDatabaseUrl: PREVIEW_CHAT_URL,
        productionChatDatabaseUrl: PRODUCTION_CHAT_URL,
        previewNeonAuthBaseUrl: "https://auth.prod.example",
        productionNeonAuthBaseUrl: "https://auth.prod.example",
        previewNeonAuthJwksUrl:
          "https://auth.preview.example/.well-known/jwks.json",
        previewNeonAuthIssuer: "https://auth.preview.example",
        neonAuthCookieSecret: "x".repeat(32),
        betterAuthSecret: "y".repeat(32),
        betterAuthUrl: "https://fleet-pi-web.example.workers.dev",
        betterAuthTrustedOrigins: "https://fleet-pi-web.example.workers.dev",
        viteNeonAuthUrl: "https://auth.preview.example",
        neonAiGatewayToken: "nt_preview_gateway",
        neonAiGatewayBaseUrl: "https://preview-gateway.neon.tech",
      })
    ).toThrow(PreviewWorkerIsolationError)
  })

  it("builds only allowlisted preview secrets", () => {
    const secrets = buildPreviewWorkerSecrets({
      previewChatDatabaseUrl: PREVIEW_CHAT_URL,
      productionChatDatabaseUrl: PRODUCTION_CHAT_URL,
      previewNeonAuthBaseUrl: "https://auth.preview.example",
      productionNeonAuthBaseUrl: "https://auth.prod.example",
      previewNeonAuthJwksUrl:
        "https://auth.preview.example/.well-known/jwks.json",
      previewNeonAuthIssuer: "https://auth.preview.example",
      neonAuthCookieSecret: "x".repeat(32),
      betterAuthSecret: "y".repeat(32),
      betterAuthUrl: "https://fleet-pi-web.example.workers.dev",
      betterAuthTrustedOrigins: "https://fleet-pi-web.example.workers.dev",
      viteNeonAuthUrl: "https://auth.preview.example",
      neonAiGatewayToken: "nt_preview_gateway",
      neonAiGatewayBaseUrl: "https://preview-gateway.neon.tech",
    })

    expect(secrets.FLEET_PI_CHAT_DATABASE_URL).toBe(PREVIEW_CHAT_URL)
    expect(secrets.DATABASE_URL).toBe(PREVIEW_CHAT_URL)
    expect(secrets.FLEET_PI_PREVIEW_DATABASE_MARKER).toBe(
      "ep-preview.aws.neon.tech"
    )
    expect(Object.keys(secrets).sort()).toEqual(
      [
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_TRUSTED_ORIGINS",
        "BETTER_AUTH_URL",
        "DATABASE_URL",
        "FLEET_PI_CHAT_DATABASE_URL",
        "FLEET_PI_PREVIEW_DATABASE_MARKER",
        "FLEET_PI_PRODUCTION_DATABASE_MARKER",
        "NEON_AI_GATEWAY_BASE_URL",
        "NEON_AI_GATEWAY_TOKEN",
        "NEON_AUTH_BASE_URL",
        "NEON_AUTH_COOKIE_SECRET",
        "NEON_AUTH_ISSUER",
        "NEON_AUTH_JWKS_URL",
        "VITE_NEON_AUTH_URL",
      ].sort()
    )
    assertPreviewSecretAllowlist(Object.keys(secrets))
  })

  it("does not read production pi_sessions rows from an isolated preview database", async () => {
    const productionDb = new PGlite()
    const previewDb = new PGlite()
    await bootstrapSessionsTable(productionDb)
    await bootstrapSessionsTable(previewDb)

    const sessionId = "prod-session-1"
    const userId = "11111111-1111-4111-8111-111111111111"

    await productionDb.exec(`
      INSERT INTO pi_sessions (
        id,
        user_id,
        session_file_path,
        cwd,
        created_at,
        updated_at
      )
      VALUES (
        '${sessionId}',
        '${userId}',
        'sessions/test.jsonl',
        '/tmp',
        NOW(),
        NOW()
      );
    `)

    const prodRows = await productionDb.query<{ id: string }>(
      "SELECT id FROM pi_sessions WHERE id = $1",
      [sessionId]
    )
    expect(prodRows.rows).toHaveLength(1)

    const previewRows = await previewDb.query<{ id: string }>(
      "SELECT id FROM pi_sessions WHERE id = $1",
      [sessionId]
    )
    expect(previewRows.rows).toHaveLength(0)
  }, 15_000)
})
