import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { betterAuth } from "better-auth"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import Database from "better-sqlite3"
import { getDefaultProjectRoot } from "@/lib/app-runtime"

function getAuthDatabasePath(): string {
  if (process.env.AUTH_DATABASE_PATH) {
    return process.env.AUTH_DATABASE_PATH
  }
  return resolve(getDefaultProjectRoot(), ".fleet", "auth.sqlite")
}

function openAuthDatabase() {
  const dbPath = getAuthDatabasePath()
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

export const auth = betterAuth({
  database: openAuthDatabase(),
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
    : [
        process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
      ],
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
