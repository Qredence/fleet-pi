import { mkdirSync, realpathSync } from "node:fs"
import { resolve } from "node:path"
import {
  createAgentSessionServices,
  getAgentDir,
} from "@mariozechner/pi-coding-agent"
import type { AgentSessionServices } from "@mariozechner/pi-coding-agent"
import type { AppRuntimeContext } from "@/lib/app-runtime"

export const DEFAULT_BEDROCK_MODEL = "us.anthropic.claude-sonnet-4-6"

export function encodeEvent(event: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export async function createSessionServices(
  context: AppRuntimeContext,
  overrides?: Parameters<typeof createAgentSessionServices>[0]
) {
  return createAgentSessionServices({
    cwd: context.projectRoot,
    agentDir: process.env.PI_AGENT_DIR ?? getAgentDir(),
    ...overrides,
  })
}

export function getSessionDir(
  repoRoot: string,
  services: AgentSessionServices
) {
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

export function collectDiagnostics(
  services: AgentSessionServices,
  modelFallbackMessage?: string
) {
  const diagnostics = new Set<string>()

  if (modelFallbackMessage) diagnostics.add(modelFallbackMessage)
  for (const diagnostic of services.diagnostics) {
    diagnostics.add(diagnostic.message)
  }

  const modelError = services.modelRegistry.getError()
  if (modelError) diagnostics.add(modelError)

  for (const { scope, error } of services.settingsManager.drainErrors()) {
    diagnostics.add(`(${scope} settings) ${error.message}`)
  }

  const resourceDiagnostics = [
    ...services.resourceLoader.getSkills().diagnostics,
    ...services.resourceLoader.getPrompts().diagnostics,
    ...services.resourceLoader.getThemes().diagnostics,
  ]
  for (const diagnostic of resourceDiagnostics) {
    diagnostics.add(diagnostic.message)
  }
  for (const diagnostic of services.resourceLoader.getExtensions().errors) {
    diagnostics.add(`${diagnostic.path}: ${diagnostic.error}`)
  }

  return [...diagnostics]
}

function getDefaultRepoSessionDir(repoRoot: string) {
  return resolve(repoRoot, ".fleet", "sessions")
}
