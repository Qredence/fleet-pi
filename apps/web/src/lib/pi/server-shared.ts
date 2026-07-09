import { mkdirSync, realpathSync } from "node:fs"
import { resolve } from "node:path"
import { createSessionServices } from "./runtime/session-factory"
import { DEFAULT_MODEL } from "./runtime/types"
import {
  collectDiagnostics,
  resolveDefaultModelSelection,
} from "./runtime/diagnostics"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"

export {
  DEFAULT_MODEL,
  collectDiagnostics,
  createSessionServices,
  resolveDefaultModelSelection,
}

export function encodeEvent(event: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export function getSessionDir(
  repoRoot: string,
  services: AgentSessionServices
) {
  if (process.env.VERCEL === "1") {
    const sessionDir = "/tmp/.fleet/sessions"
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
