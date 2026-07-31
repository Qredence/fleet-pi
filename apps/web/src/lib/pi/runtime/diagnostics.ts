import { mirrorMetrics } from "../../db/pi-session-mirror"
import { CHAT_TOOL_ALLOWLIST } from "../plan-mode"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import type { WorkspaceHealthResponse } from "../../workspace/bootstrap-agent-workspace"

type ModelDefaultSettingsLike = {
  getDefaultModel: () => string | undefined
  getDefaultProvider: () => string | undefined
}

type ServicesWithWorkspaceBootstrap = AgentSessionServices & {
  workspaceBootstrap?: WorkspaceHealthResponse
}

/**
 * Collects and deduplicates workspace, service, resource, tool, and database synchronization diagnostics.
 *
 * @param modelFallbackMessage - Optional message describing a model fallback.
 * @returns An array of unique diagnostic messages.
 */
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

  const modelError = services.modelRuntime.getError()
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

  const extensionsResult = services.resourceLoader.getExtensions()
  const registeredTools = new Set<string>()
  for (const extension of extensionsResult.extensions) {
    for (const toolName of extension.tools.keys()) {
      registeredTools.add(toolName)
    }
  }

  const allowlistSet = new Set(CHAT_TOOL_ALLOWLIST)

  for (const tool of registeredTools) {
    if (!allowlistSet.has(tool)) {
      diagnostics.add(
        `[Tool Drift] Registered tool "${tool}" is not present in CHAT_TOOL_ALLOWLIST.`
      )
    }
  }

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

/**
 * Resolves the explicitly configured default provider and model.
 *
 * @returns The configured provider and model, preserving `undefined` for values that are not set
 */
export function resolveDefaultModelSelection(
  settingsManager: ModelDefaultSettingsLike
): { defaultProvider?: string; defaultModel?: string } {
  return {
    defaultProvider: settingsManager.getDefaultProvider(),
    defaultModel: settingsManager.getDefaultModel(),
  }
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
