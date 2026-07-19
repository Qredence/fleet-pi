import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { betterAuth } from "better-auth"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { Pool } from "@neondatabase/serverless"
import Database from "better-sqlite3"
import { getDefaultProjectRoot } from "@/lib/app-runtime"
import {
  LOCAL_AUTH_URL,
  PRODUCTION_AUTH_URL,
  resolvePreviewAuthOrigin,
  resolveTrustedOriginsForDeployment,
  resolveVercelAllowedHosts,
} from "@/lib/auth/auth-host-policy"
import { isVercelDeployment } from "@/lib/deployment/environment"
import { isVercelPreviewDeployment } from "@/lib/deployment/trust-zone"

function readCsvEnv(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function requiredVercelEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value && isVercelDeployment()) {
    throw new Error(`${name} is required for Better Auth on Vercel.`)
  }
  return value
}

function openAuthDatabase() {
  const url = process.env.FLEET_PI_AUTH_DATABASE_URL?.trim()
  if (url) return new Pool({ connectionString: url })
  if (isVercelDeployment()) {
    throw new Error(
      "FLEET_PI_AUTH_DATABASE_URL is required for Better Auth on Vercel."
    )
  }

  const dbPath =
    process.env.AUTH_DATABASE_PATH ??
    resolve(getDefaultProjectRoot(), ".fleet", "auth.sqlite")
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
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
  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (!isVercelDeployment()) return configuredBaseURL ?? LOCAL_AUTH_URL

  const previewFallback = resolvePreviewAuthOrigin({
    betterAuthUrl: configuredBaseURL,
    vercelUrl,
  })

  return {
    allowedHosts: resolveVercelAllowedHosts(configuredBaseURL, vercelUrl),
    protocol: "https" as const,
    fallback: isVercelPreviewDeployment()
      ? (previewFallback ?? PRODUCTION_AUTH_URL)
      : (configuredBaseURL ?? PRODUCTION_AUTH_URL),
  }
}

function resolveTrustedOrigins() {
  return resolveTrustedOriginsForDeployment({
    isVercel: isVercelDeployment(),
    isPreview: isVercelPreviewDeployment(),
    configuredOrigins: readCsvEnv("BETTER_AUTH_TRUSTED_ORIGINS"),
    betterAuthUrl: process.env.BETTER_AUTH_URL?.trim(),
    vercelUrl: process.env.VERCEL_URL?.trim(),
  })
}

const betterAuthSecret = requiredVercelEnv("BETTER_AUTH_SECRET")
const authSecret =
  betterAuthSecret ?? "fleet-pi-local-development-secret-change-in-production"

export const legacyBetterAuth = betterAuth({
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
  plugins: [tanstackStartCookies()],
})
