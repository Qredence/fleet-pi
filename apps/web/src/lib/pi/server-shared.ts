import { mkdirSync, realpathSync } from "node:fs"
import { resolve } from "node:path"
import { createSessionServices } from "./runtime/session-factory"
import {
  collectDiagnostics,
  resolveDefaultModelSelection,
} from "./runtime/diagnostics"
import {
  VERCEL_EPHEMERAL_SESSION_BASE,
  resolveVercelUserSessionDir,
} from "./session-paths"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import { isVercelDeployment } from "@/lib/deployment/environment"

export {
  collectDiagnostics,
  createSessionServices,
  resolveDefaultModelSelection,
}

// Reuse TextEncoder instance to eliminate one allocation per streamed event
const encoder = new TextEncoder()

export function encodeEvent(event: unknown) {
  return encoder.encode(`${JSON.stringify(event)}\n`)
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export function getSessionDir(
  repoRoot: string,
  services: AgentSessionServices,
  options: { userId?: string } = {}
) {
  if (isVercelDeployment()) {
    const sessionDir = options.userId
      ? resolveVercelUserSessionDir(options.userId)
      : VERCEL_EPHEMERAL_SESSION_BASE
    mkdirSync(sessionDir, { recursive: true })
    return sessionDir
  }

  const configuredSessionDir = services.settingsManager.getSessionDir()
  const sessionDir = configuredSessionDir
    ? resolve(repoRoot, configuredSessionDir)
    : getDefaultRepoSessionDir(repoRoot)

  mkdirSync(sessionDir, { recursive: true })
  return sessionDir
}

export function safeRealpath(path: string) {
  try {
    return realpathSync(resolve(path))
  } catch {
    return undefined
  }
}

function getDefaultRepoSessionDir(repoRoot: string) {
  return resolve(repoRoot, ".fleet", "sessions")
}
