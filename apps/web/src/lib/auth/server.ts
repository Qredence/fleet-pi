import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { betterAuth } from "better-auth"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { Pool } from "@neondatabase/serverless"
import Database from "better-sqlite3"
import { getDefaultProjectRoot } from "@/lib/app-runtime"

const PRODUCTION_AUTH_URL = "https://fleet-pi-web.vercel.app"
const LOCAL_AUTH_URL = "http://localhost:3000"
const LOCAL_TRUSTED_ORIGINS = [
  LOCAL_AUTH_URL,
  "http://localhost:3001",
  "http://localhost:3002",
]
const VERCEL_AUTH_HOSTS = [
  "fleet-pi-web.vercel.app",
  "fleet-pi-web-qredence.vercel.app",
  "fleet-pi-web-git-main-qredence.vercel.app",
  "*.vercel.app",
]

function isVercelRuntime() {
  return process.env.VERCEL === "1"
}

function readCsvEnv(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function requiredVercelEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value && isVercelRuntime()) {
    throw new Error(`${name} is required for Better Auth on Vercel.`)
  }
  return value
}

function toHost(value: string) {
  try {
    return new URL(value).host
  } catch {
    return value.replace(/^https?:\/\//, "").split("/")[0]
  }
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as Array<string>)]
}

function openAuthDatabase() {
  const url = process.env.FLEET_PI_AUTH_DATABASE_URL?.trim()
  if (url) return new Pool({ connectionString: url })
  if (isVercelRuntime()) {
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
  if (!isVercelRuntime()) return configuredBaseURL ?? LOCAL_AUTH_URL

  return {
    allowedHosts: unique([
      configuredBaseURL ? toHost(configuredBaseURL) : undefined,
      ...VERCEL_AUTH_HOSTS,
    ]),
    protocol: "https" as const,
    fallback: configuredBaseURL ?? PRODUCTION_AUTH_URL,
  }
}

function resolveTrustedOrigins() {
  const configuredOrigins = readCsvEnv("BETTER_AUTH_TRUSTED_ORIGINS")
  if (configuredOrigins.length > 0) return configuredOrigins
  if (!isVercelRuntime()) {
    return unique([
      process.env.BETTER_AUTH_URL?.trim(),
      ...LOCAL_TRUSTED_ORIGINS,
    ])
  }

  return [
    PRODUCTION_AUTH_URL,
    "https://fleet-pi-web-qredence.vercel.app",
    "https://fleet-pi-web-git-main-qredence.vercel.app",
    "https://*.vercel.app",
  ]
}

const betterAuthSecret = requiredVercelEnv("BETTER_AUTH_SECRET")
const authSecret =
  betterAuthSecret ?? "fleet-pi-local-development-secret-change-in-production"

export const auth = betterAuth({
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
