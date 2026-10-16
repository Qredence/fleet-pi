import { mkdirSync, realpathSync } from "node:fs"
import { resolve } from "node:path"
import { createSessionServices } from "./runtime/session-factory"
import {
  collectDiagnostics,
  resolveDefaultModelSelection,
} from "./runtime/diagnostics"
import {
  HOSTED_EPHEMERAL_SESSION_BASE,
  resolveHostedUserSessionDir,
} from "./session-paths"
import { isDeployedChatRuntimeSurface } from "./runtime/deployed-chat-runtime"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"

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
  if (isDeployedChatRuntimeSurface()) {
    const sessionDir = options.userId
      ? resolveHostedUserSessionDir(options.userId)
      : HOSTED_EPHEMERAL_SESSION_BASE
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
