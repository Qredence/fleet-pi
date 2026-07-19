#!/usr/bin/env node
/**
 * Verifies Postgres, Neon Auth, Object Storage, and the chat Function on the
 * linked Neon branch. Loads .env then .env.local from the repo root.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, "..")
const webRoot = join(repoRoot, "apps", "web")
const require = createRequire(join(webRoot, "package.json"))

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const text = readFileSync(path, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function loadEnv() {
  loadEnvFile(join(repoRoot, ".env"))
  loadEnvFile(join(repoRoot, ".env.local"))
}

function resolveChatDatabaseUrl() {
  return (
    process.env.FLEET_PI_CHAT_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  )
}

function readNeonContext() {
  const contextPath = join(repoRoot, ".neon")
  if (!existsSync(contextPath)) return {}
  try {
    return JSON.parse(readFileSync(contextPath, "utf8"))
  } catch {
    return {}
  }
}

function neonCommandArgs(extra = []) {
  const context = readNeonContext()
  const args = [...extra]
  if (context.projectId) {
    args.push("--project-id", context.projectId)
  }
  return args
}

function runNeonJson(command, extraArgs = []) {
  const env = { ...process.env }
  delete env.NEON_API_KEY
  const raw = execFileSync("neon", [...command, ...neonCommandArgs(extraArgs)], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
  })
  return JSON.parse(raw)
}

function resolveFunctionUrl() {
  const explicit =
    process.env.VITE_FLEET_PI_CHAT_RUNTIME_URL?.trim() ||
    process.env.FLEET_PI_CHAT_RUNTIME_URL?.trim() ||
    ""
  if (explicit) return explicit.replace(/\/$/, "")

  try {
    const parsed = runNeonJson(["functions", "get", "chat", "-o", "json"])
    return String(parsed.invocation_url ?? "").replace(/\/$/, "")
  } catch {
    return ""
  }
}

async function checkPostgres(results) {
  const url = resolveChatDatabaseUrl()
  if (!url) {
    results.push({ id: "postgres", ok: false, message: "No chat database URL" })
    return
  }
  const { neon } = require("@neondatabase/serverless")
  const rows = await neon(url)`SELECT 1 AS ok`
  const ok = rows?.[0]?.ok === 1
  results.push({
    id: "postgres",
    ok,
    message: ok ? "SELECT 1 succeeded" : "Unexpected SELECT 1 result",
  })
}

function checkAuth(results) {
  try {
    const parsed = runNeonJson(["neon-auth", "status", "-o", "json"])
    const ok = Boolean(parsed.base_url && parsed.jwks_url)
    results.push({
      id: "auth",
      ok,
      message: ok
        ? "Neon Auth base_url and jwks_url present"
        : "Neon Auth status missing URLs",
    })
  } catch {
    const ok = Boolean(
      process.env.NEON_AUTH_BASE_URL?.trim() &&
        process.env.NEON_AUTH_JWKS_URL?.trim()
    )
    results.push({
      id: "auth",
      ok,
      message: ok
        ? "NEON_AUTH_BASE_URL and NEON_AUTH_JWKS_URL present in env"
        : "Neon Auth status unavailable and env URLs missing",
    })
  }
}

async function checkObjectStorage(results) {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim()
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    results.push({
      id: "object-storage",
      ok: false,
      message: "AWS_* object storage env vars not configured",
    })
    return
  }

  const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, S3Client } =
    require("@aws-sdk/client-s3")
  const client = new S3Client({
    region: process.env.AWS_REGION?.trim() || "us-east-2",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
  const key = `__healthcheck__/${Date.now()}.txt`
  const body = "fleet-pi-neon-healthcheck"
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: "sessions",
        Key: key,
        Body: body,
        ContentType: "text/plain",
      })
    )
    const got = await client.send(
      new GetObjectCommand({ Bucket: "sessions", Key: key })
    )
    const bytes = await got.Body?.transformToString()
    await client.send(
      new DeleteObjectCommand({ Bucket: "sessions", Key: key })
    )
    const ok = bytes === body
    results.push({
      id: "object-storage",
      ok,
      message: ok
        ? "sessions bucket Put/Get/Delete roundtrip succeeded"
        : "sessions bucket roundtrip payload mismatch",
    })
  } catch (error) {
    results.push({
      id: "object-storage",
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function checkFunction(results) {
  const baseUrl = resolveFunctionUrl()
  if (!baseUrl) {
    results.push({
      id: "function",
      ok: false,
      message: "Chat function invocation URL not configured",
    })
    return
  }
  try {
    const response = await fetch(`${baseUrl}/health`)
    const json = await response.json()
    const ok =
      response.ok &&
      json?.ok === true &&
      json?.service === "fleet-pi-chat-runtime"
    results.push({
      id: "function",
      ok,
      message: ok
        ? `GET ${baseUrl}/health returned ok`
        : `Unexpected health response (${response.status})`,
    })
  } catch (error) {
    results.push({
      id: "function",
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function checkReadiness(results) {
  const hasMigrationUrls = Boolean(
    process.env.FLEET_PI_AUTH_MIGRATION_DATABASE_URL?.trim() &&
      process.env.FLEET_PI_CHAT_MIGRATION_DATABASE_URL?.trim()
  )
  if (!hasMigrationUrls) {
    results.push({
      id: "deployment-readiness",
      ok: true,
      message: "Skipped (owner migration URLs not set in env)",
    })
    return
  }
  try {
    execFileSync("pnpm", ["verify-deployment-readiness"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
      env: process.env,
    })
    results.push({
      id: "deployment-readiness",
      ok: true,
      message: "pnpm verify-deployment-readiness passed",
    })
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr)
        : error instanceof Error
          ? error.message
          : String(error)
    results.push({
      id: "deployment-readiness",
      ok: false,
      message: stderr.trim() || "verify-deployment-readiness failed",
    })
  }
}

async function main() {
  loadEnv()
  const results = []
  await checkPostgres(results)
  checkAuth(results)
  await checkObjectStorage(results)
  await checkFunction(results)
  checkReadiness(results)

  let failed = false
  for (const result of results) {
    const prefix = result.ok ? "✓" : "✗"
    console.log(`${prefix} ${result.id}: ${result.message}`)
    if (!result.ok) failed = true
  }

  if (failed) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
