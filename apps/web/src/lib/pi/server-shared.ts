import { mkdirSync, realpathSync } from "node:fs"
import { resolve } from "node:path"
import {
  createAgentSessionServices,
  getAgentDir,
} from "@earendil-works/pi-coding-agent"
import {
  bootstrapAgentWorkspace,
  createWorkspaceHealthFailure,
} from "../workspace/bootstrap-agent-workspace"
import { KNOWN_PROVIDERS } from "../../routes/api/chat/providers"
import { mirrorMetrics } from "../db/pi-session-mirror"
import { CHAT_TOOL_ALLOWLIST } from "./plan-mode"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import type { WorkspaceHealthResponse } from "../workspace/bootstrap-agent-workspace"

export const DEFAULT_MODEL = "gemini-3.5-flash"

type ModelDefaultSettingsLike = {
  getDefaultModel: () => string | undefined
  getDefaultProvider: () => string | undefined
}

type ServicesWithWorkspaceBootstrap = AgentSessionServices & {
  workspaceBootstrap?: WorkspaceHealthResponse
}

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
  if (process.env.VERCEL === "1") {
    // Strictly enforce BYOK on Vercel by scrubbing global LLM env vars
    for (const provider of KNOWN_PROVIDERS) {
      delete process.env[provider.envVarName]
    }
  }

  const workspaceBootstrap = await loadBestEffortWorkspaceHealth(context)
  const services = await createAgentSessionServices({
    cwd: context.projectRoot,
    agentDir: process.env.PI_AGENT_DIR ?? getAgentDir(),
    ...overrides,
  })

  return attachWorkspaceBootstrap(services, workspaceBootstrap)
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

export function collectDiagnostics(
  services: AgentSessionServices,
  modelFallbackMessage?: string
) {
  const diagnostics = new Set<string>()
  for (const diagnostic of getWorkspaceBootstrapMessages(services)) {
    diagnostics.add(diagnostic)
  }

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

  // Tool allowlist drift detection
  const extensionsResult = services.resourceLoader.getExtensions()
  const registeredTools = new Set<string>()
  for (const extension of extensionsResult.extensions) {
    for (const toolName of extension.tools.keys()) {
      registeredTools.add(toolName)
    }
  }

  const allowlistSet = new Set(CHAT_TOOL_ALLOWLIST)

  // 1. Unlisted tools: registered by dynamic extensions but not in CHAT_TOOL_ALLOWLIST
  for (const tool of registeredTools) {
    if (!allowlistSet.has(tool)) {
      diagnostics.add(
        `[Tool Drift] Registered tool "${tool}" is not present in CHAT_TOOL_ALLOWLIST.`
      )
    }
  }

  // 2. Unregistered tools: present in CHAT_TOOL_ALLOWLIST but not registered by any extension and not a built-in tool
  const BUILT_IN_TOOLS = new Set([
    "read",
    "write",
    "edit",
    "bash",
    "grep",
    "find",
    "ls",
  ])
  for (const tool of allowlistSet) {
    if (!BUILT_IN_TOOLS.has(tool) && !registeredTools.has(tool)) {
      diagnostics.add(
        `[Tool Drift] Allowed tool "${tool}" is not registered by any loaded extension.`
      )
    }
  }

  if (mirrorMetrics.failures > 0) {
    const lastError = mirrorMetrics.lastFailureReason
      ? `. Last error: ${mirrorMetrics.lastFailureReason}`
      : ""
    diagnostics.add(
      `[Mirror Health] Database synchronization has failed ${mirrorMetrics.failures} times${lastError}`
    )
  }

  return [...diagnostics]
}

export function resolveDefaultModelSelection(
  settingsManager: ModelDefaultSettingsLike
) {
  return {
    defaultProvider: settingsManager.getDefaultProvider() ?? "google",
    defaultModel: settingsManager.getDefaultModel() ?? DEFAULT_MODEL,
  }
}

interface BootstrapRetryState {
  attempts: number
  lastAttemptTime: number
  nextRetryDelay: number
  lastResult?: WorkspaceHealthResponse
}

const bootstrapRetryStates = new WeakMap<
  AppRuntimeContext,
  BootstrapRetryState
>()

async function loadBestEffortWorkspaceHealth(
  context: AppRuntimeContext
): Promise<WorkspaceHealthResponse> {
  const now = Date.now()
  let state = bootstrapRetryStates.get(context)

  if (!state) {
    state = {
      attempts: 0,
      lastAttemptTime: 0,
      nextRetryDelay: 1000, // 1 second initial delay
    }
    bootstrapRetryStates.set(context, state)
  }

  // If there is an active promise already, await it
  if (context.workspaceBootstrap) {
    try {
      const result = await context.workspaceBootstrap
      if (result.status === "ok" && result.workspace.available) {
        // Success! Reset retry state
        state.attempts = 0
        state.nextRetryDelay = 1000
        state.lastResult = result
        return result
      }
      // If it resolved to a failed/degraded state, fall through to the retry check
      state.lastResult = result
    } catch (error) {
      const failure = createWorkspaceHealthFailure(context, error)
      state.lastResult = failure
    }
  }

  // If we have a failure, check if we are still within the backoff window
  if (state.lastResult) {
    const timeSinceLastAttempt = now - state.lastAttemptTime
    if (timeSinceLastAttempt < state.nextRetryDelay) {
      // Inside backoff window - return the cached failure to avoid spamming
      return state.lastResult
    }
  }

  // We are allowed to (re)try!
  state.attempts++
  state.lastAttemptTime = now
  // Calculate next delay: initial delay * 2^(attempts-1), capped at 30 seconds
  if (state.attempts > 1) {
    state.nextRetryDelay = Math.min(state.nextRetryDelay * 2, 30000)
  }

  const promise = bootstrapAgentWorkspace(context)
    .then((result) => {
      if (result.status === "ok" && result.workspace.available) {
        // Reset state on successful bootstrap execution completion
        state.attempts = 0
        state.nextRetryDelay = 1000
      }
      state.lastResult = result
      return result
    })
    .catch((error) => {
      const failure = createWorkspaceHealthFailure(context, error)
      state.lastResult = failure
      return failure
    })

  context.workspaceBootstrap = promise
  return promise
}

function attachWorkspaceBootstrap(
  services: AgentSessionServices,
  workspaceBootstrap: WorkspaceHealthResponse
) {
  const servicesWithWorkspaceBootstrap =
    services as ServicesWithWorkspaceBootstrap
  servicesWithWorkspaceBootstrap.workspaceBootstrap = workspaceBootstrap
  return servicesWithWorkspaceBootstrap
}

function getWorkspaceBootstrapMessages(services: AgentSessionServices) {
  const workspaceBootstrap = (services as ServicesWithWorkspaceBootstrap)
    .workspaceBootstrap

  if (!workspaceBootstrap) return []

  return [
    ...workspaceBootstrap.warnings,
    ...workspaceBootstrap.diagnostics.map((diagnostic) => diagnostic.message),
  ]
}

function getDefaultRepoSessionDir(repoRoot: string) {
  return resolve(repoRoot, ".fleet", "sessions")
}
