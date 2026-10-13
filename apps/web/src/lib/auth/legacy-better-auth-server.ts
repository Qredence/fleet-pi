import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { betterAuth } from "better-auth"
import { Pool } from "@neondatabase/serverless"
import type Database from "better-sqlite3"
import { getDefaultProjectRoot } from "@/lib/app-runtime"
import {
  LOCAL_AUTH_URL,
  PRODUCTION_AUTH_URL,
  resolveHostedAllowedHosts,
  resolveTrustedOriginsForDeployment,
} from "@/lib/auth/auth-host-policy"
import { isHostedDeployment } from "@/lib/deployment/environment"
import { isHostedPreviewDeployment } from "@/lib/deployment/trust-zone"
import { isInRequestScope, requestScoped } from "@/lib/runtime/request-scope"

function readCsvEnv(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function requiredHostedEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value && isHostedDeployment()) {
    throw new Error(`${name} is required for Better Auth on Cloudflare.`)
  }
  return value
}

const REQUEST_AUTH_POOL_KEY = Symbol("fleet-pi.auth-postgres-pool")

/**
 * Better Auth keeps the database object for its lifetime. On Cloudflare
 * Workers a pool cannot be shared across requests, so hand Better Auth a
 * pool facade that resolves a per-request pool on every call.
 */
function openAuthPool(url: string) {
  const pool = new Pool({ connectionString: url })
  const current = () =>
    isInRequestScope()
      ? (requestScoped(
          REQUEST_AUTH_POOL_KEY,
          () => new Pool({ connectionString: url })
        ) as InstanceType<typeof Pool>)
      : pool
  return new Proxy(pool, {
    get(_target, property) {
      const target = current()
      const value = Reflect.get(target, property, target) as unknown
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

function openAuthDatabase() {
  const url = process.env.FLEET_PI_AUTH_DATABASE_URL?.trim()
  if (url) return openAuthPool(url)
  if (isHostedDeployment()) {
    throw new Error(
      "FLEET_PI_AUTH_DATABASE_URL is required for Better Auth on Cloudflare."
    )
  }

  const dbPath =
    process.env.AUTH_DATABASE_PATH ??
    resolve(getDefaultProjectRoot(), ".fleet", "auth.sqlite")
  mkdirSync(dirname(dbPath), { recursive: true })
  const specifier = "better-" + "sqlite3"
  const Sqlite = createRequire(import.meta.url)(specifier) as typeof Database
  const db = new Sqlite(dbPath)
  migrateAuthSchema(db)
  return db
}

function migrateAuthSchema(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "emailVerified" INTEGER NOT NULL DEFAULT 0,
      "image" TEXT,
      "createdAt" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "updatedAt" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS "session" (
      "id" TEXT PRIMARY KEY,
      "expiresAt" INTEGER NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "createdAt" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "updatedAt" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");
    CREATE TABLE IF NOT EXISTS "account" (
      "id" TEXT PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" INTEGER,
      "refreshTokenExpiresAt" INTEGER,
      "scope" TEXT,
      "password" TEXT,
      "createdAt" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "updatedAt" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");
    CREATE TABLE IF NOT EXISTS "verification" (
      "id" TEXT PRIMARY KEY,
      "identifier" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" INTEGER NOT NULL,
      "createdAt" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "updatedAt" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");
  `)
}

function resolveAuthBaseURL() {
  const configuredBaseURL = process.env.BETTER_AUTH_URL?.trim()
  if (!isHostedDeployment()) return configuredBaseURL ?? LOCAL_AUTH_URL

  return {
    allowedHosts: resolveHostedAllowedHosts(configuredBaseURL),
    protocol: "https" as const,
    fallback: configuredBaseURL ?? PRODUCTION_AUTH_URL,
  }
}

function resolveTrustedOrigins() {
  return resolveTrustedOriginsForDeployment({
    isHosted: isHostedDeployment(),
    isPreview: isHostedPreviewDeployment(),
    configuredOrigins: readCsvEnv("BETTER_AUTH_TRUSTED_ORIGINS"),
    betterAuthUrl: process.env.BETTER_AUTH_URL?.trim(),
  })
}

const betterAuthSecret = requiredHostedEnv("BETTER_AUTH_SECRET")
const authSecret =
  betterAuthSecret ?? "fleet-pi-local-development-secret-change-in-production"

export function createLegacyBetterAuth(
  plugins: Parameters<typeof betterAuth>[0]["plugins"] = []
) {
  return betterAuth({
    database: openAuthDatabase(),
    basePath: "/api/auth",
    secret: authSecret,
    baseURL: resolveAuthBaseURL(),
    trustedOrigins: resolveTrustedOrigins(),
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
    },
    plugins,
  })
}

export const legacyBetterAuth = createLegacyBetterAuth()
