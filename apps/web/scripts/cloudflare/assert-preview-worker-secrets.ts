import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { DEFAULT_APP_ROLE } from "../../src/lib/db/app-role"
import { pollPreviewBranchConnectionUri } from "../../src/lib/deployment/neon-preview-connection"
import {
  PreviewWorkerIsolationError,
  assertPreviewAuthBaseUrl,
  assertPreviewChatDatabaseUrl,
  assertPreviewSecretAllowlist,
  buildPreviewWorkerSecrets,
  findDisallowedPreviewSecretNames,
  parsePreviewDeployJson,
  previewNeonBranchName,
  previewWorkerName,
} from "../../src/lib/deployment/preview-worker-isolation"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(scriptDir, "../..")

type Command = "validate" | "write" | "audit" | "origin"

function readEnv(name: string) {
  return process.env[name]?.trim() ?? ""
}

function parseArgv(): {
  command: Command
  prNumber: string
  outputPath: string
  deployJsonPath: string
} {
  const args = process.argv.slice(2)
  const command = args[0]
  if (
    command !== "validate" &&
    command !== "write" &&
    command !== "audit" &&
    command !== "origin"
  ) {
    throw new PreviewWorkerIsolationError(
      "Usage: assert-preview-worker-secrets.ts <validate|write|audit|origin> --pr <number> [--output <path>] [--deploy-json <path>]"
    )
  }

  let prNumber = ""
  let outputPath = ""
  let deployJsonPath = ""
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "--pr" && args[i + 1]) {
      prNumber = args[i + 1]
      i += 1
      continue
    }
    if (arg === "--output" && args[i + 1]) {
      outputPath = args[i + 1]
      i += 1
      continue
    }
    if (arg === "--deploy-json" && args[i + 1]) {
      deployJsonPath = args[i + 1]
      i += 1
    }
  }

  if (command !== "origin" && !prNumber) {
    throw new PreviewWorkerIsolationError("--pr <number> is required.")
  }

  if (!outputPath && prNumber) {
    outputPath = resolve(
      webRoot,
      `.dev.vars.preview-${previewWorkerName(prNumber)}.json`
    )
  }

  return {
    command,
    prNumber,
    outputPath: outputPath ? resolve(outputPath) : "",
    deployJsonPath: deployJsonPath ? resolve(deployJsonPath) : "",
  }
}

async function resolvePreviewChatDatabaseUrl(prNumber: string) {
  const fromEnv = readEnv("FLEET_PI_PREVIEW_CHAT_DATABASE_URL")
  if (fromEnv) return fromEnv

  const projectId = readEnv("NEON_PROJECT_ID")
  const apiKey = readEnv("NEON_API_KEY")
  if (!projectId || !apiKey) {
    return ""
  }

  const branchName = previewNeonBranchName(prNumber)
  const roleName = readEnv("FLEET_PI_APP_ROLE") || DEFAULT_APP_ROLE
  const databaseName = readEnv("NEON_DATABASE_NAME") || "neondb"

  return (
    (await pollPreviewBranchConnectionUri({
      projectId,
      apiKey,
      branchName,
      roleName,
      databaseName,
      pooled: true,
      maxAttempts: Number(readEnv("NEON_PREVIEW_URI_MAX_ATTEMPTS") || "30"),
      delayMs: Number(readEnv("NEON_PREVIEW_URI_DELAY_MS") || "10000"),
    })) ?? ""
  )
}

function loadSecretsInput(previewChatDatabaseUrl: string) {
  const workerOrigin = readEnv("PREVIEW_WORKER_ORIGIN")
  const trustedOrigins =
    readEnv("PREVIEW_BETTER_AUTH_TRUSTED_ORIGINS") || workerOrigin

  return buildPreviewWorkerSecrets({
    previewChatDatabaseUrl,
    productionChatDatabaseUrl: readEnv("FLEET_PI_PRODUCTION_CHAT_DATABASE_URL"),
    previewNeonAuthBaseUrl: readEnv("PREVIEW_NEON_AUTH_BASE_URL"),
    productionNeonAuthBaseUrl: readEnv(
      "FLEET_PI_PRODUCTION_NEON_AUTH_BASE_URL"
    ),
    previewNeonAuthJwksUrl: readEnv("PREVIEW_NEON_AUTH_JWKS_URL"),
    previewNeonAuthIssuer: readEnv("PREVIEW_NEON_AUTH_ISSUER"),
    neonAuthCookieSecret: readEnv("PREVIEW_NEON_AUTH_COOKIE_SECRET"),
    betterAuthSecret: readEnv("PREVIEW_BETTER_AUTH_SECRET"),
    betterAuthUrl: workerOrigin,
    betterAuthTrustedOrigins: trustedOrigins,
  })
}

function writeSecretsFile(outputPath: string, secrets: Record<string, string>) {
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(secrets, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
  chmodSync(outputPath, 0o600)
}

function parseSecretListJson(stdout: string): Array<string> {
  const parsed = JSON.parse(stdout) as unknown
  if (Array.isArray(parsed)) {
    return parsed
      .map((entry) => {
        if (typeof entry === "string") return entry
        if (entry && typeof entry === "object" && "name" in entry) {
          const name = (entry as { name?: unknown }).name
          return typeof name === "string" ? name : ""
        }
        return ""
      })
      .filter((name) => name.length > 0)
  }

  if (parsed && typeof parsed === "object") {
    const result = (parsed as { result?: unknown }).result
    if (Array.isArray(result)) {
      return result
        .map((entry) => {
          if (entry && typeof entry === "object" && "name" in entry) {
            const name = (entry as { name?: unknown }).name
            return typeof name === "string" ? name : ""
          }
          return ""
        })
        .filter((name) => name.length > 0)
    }
  }

  throw new PreviewWorkerIsolationError(
    "Could not parse wrangler preview secret list JSON."
  )
}

async function runAudit(prNumber: string) {
  const { execFileSync } = await import("node:child_process")
  const previewName = previewWorkerName(prNumber)
  const stdout = execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "preview",
      "secret",
      "list",
      "--name",
      previewName,
      "--json",
    ],
    {
      cwd: webRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  )

  const names = parseSecretListJson(stdout)
  const extras = findDisallowedPreviewSecretNames(names)

  if (extras.length > 0) {
    for (const extra of extras) {
      execFileSync(
        "pnpm",
        [
          "exec",
          "wrangler",
          "preview",
          "secret",
          "delete",
          extra,
          "--name",
          previewName,
          "--skip-confirmation",
        ],
        { cwd: webRoot, stdio: "inherit" }
      )
    }
    throw new PreviewWorkerIsolationError(
      `Removed disallowed preview secrets: ${extras.join(", ")}. Re-run preview secret bulk.`
    )
  }

  assertPreviewSecretAllowlist(names)
}

function printPreviewOrigin(deployJsonPath: string) {
  if (!deployJsonPath) {
    throw new PreviewWorkerIsolationError(
      "--deploy-json <path> is required for origin."
    )
  }
  const raw = readFileSync(deployJsonPath, "utf8")
  const payload = JSON.parse(raw) as unknown
  const origin = parsePreviewDeployJson(payload)
  if (!origin) {
    throw new PreviewWorkerIsolationError(
      "Could not resolve preview Worker origin from wrangler preview --json output."
    )
  }
  process.stdout.write(`${origin}\n`)
}

async function main() {
  const { command, prNumber, outputPath, deployJsonPath } = parseArgv()
  const productionChatUrl = readEnv("FLEET_PI_PRODUCTION_CHAT_DATABASE_URL")

  if (command === "origin") {
    printPreviewOrigin(deployJsonPath)
    return
  }

  if (command === "audit") {
    await runAudit(prNumber)
    return
  }

  const previewChatUrl = await resolvePreviewChatDatabaseUrl(prNumber)
  assertPreviewChatDatabaseUrl(previewChatUrl, productionChatUrl)

  const previewAuthBase = readEnv("PREVIEW_NEON_AUTH_BASE_URL")
  const productionAuthBase = readEnv("FLEET_PI_PRODUCTION_NEON_AUTH_BASE_URL")
  if (!previewAuthBase || !productionAuthBase) {
    throw new PreviewWorkerIsolationError(
      "PREVIEW_NEON_AUTH_BASE_URL and FLEET_PI_PRODUCTION_NEON_AUTH_BASE_URL are required for preview isolation."
    )
  }
  assertPreviewAuthBaseUrl(previewAuthBase, productionAuthBase)

  if (command === "validate") {
    return
  }

  const secrets = loadSecretsInput(previewChatUrl)
  writeSecretsFile(outputPath, secrets)
  process.stdout.write(`${outputPath}\n`)
}

main().catch((error: unknown) => {
  if (error instanceof PreviewWorkerIsolationError) {
    console.error(error.message)
    process.exit(1)
  }
  if (error instanceof Error) {
    console.error(error.message)
    process.exit(1)
  }
  console.error("Preview Worker isolation check failed.")
  process.exit(1)
})
