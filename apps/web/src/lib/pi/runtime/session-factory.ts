import { join } from "node:path"
import {
  SettingsManager,
  createAgentSessionServices,
  getAgentDir,
} from "@earendil-works/pi-coding-agent"
import { PROVIDER_ENV_SCRUB_VAR_NAMES } from "@workspace/pi-protocol/provider-catalog"
import { isHostedDeployment } from "../../deployment/environment"
import {
  bootstrapAgentWorkspace,
  createWorkspaceHealthFailure,
} from "../../workspace/bootstrap-agent-workspace"
import { installHarnessWriteResolver } from "../../daytona/harness-write-target"
import { AGENT_WORKSPACE_DIRECTORY } from "../../workspace/workspace-contract"
import { excludeStockDaytonaPiExtension } from "../exclude-stock-daytona-pi"
import { createPlanModeExtension } from "../plan-mode"
import { resolveLoaderProjectTrust } from "./project-trust"
import {
  isDeployedChatRuntimeSurface,
  usesDatabaseBackedProjectSettings,
} from "./deployed-chat-runtime"
import { createIsolatedProjectSettings } from "./isolated-project-settings"
import { createSandboxResourceSettings } from "./sandbox-resource-settings"
import { buildFleetPiInlineExtensions } from "./fleet-pi-core-extensions"
import { captureAndScrubNeonAiGatewayEnv } from "./neon-ai-gateway"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import type { WorkspaceHealthResponse } from "../../workspace/bootstrap-agent-workspace"
import type { ApplyRuntimeAuthOptions } from "./types"
import type { ChatWorkspaceStatus } from "@workspace/pi-protocol/chat-protocol"

type ServicesWithWorkspaceBootstrap = AgentSessionServices & {
  workspaceBootstrap?: WorkspaceHealthResponse
}

interface BootstrapRetryState {
  promise?: Promise<WorkspaceHealthResponse>
  attempts: number
  lastAttemptTime: number
  nextRetryDelay: number
  lastResult?: WorkspaceHealthResponse
}

// Module-level bootstrap cache keyed by project root, shared across requests so
// the workspace bootstrap runs once per project root (and per retry window)
// instead of re-running on every chat turn. The in-flight `promise` is created
// once and awaited by all concurrent callers; once settled it is cleared and
// the result is served through `lastResult` + exponential backoff.
const bootstrapCache = new Map<string, BootstrapRetryState>()

// Bound the cache so long-running servers serving many project roots do not
// accumulate bootstrap state indefinitely. Map iteration order is insertion
// order; entries are re-inserted on access, so the first key is always the
// least-recently-used project root and is evicted when a new root is inserted
// beyond the cap. An evicted root simply re-bootstraps on its next request.
const BOOTSTRAP_CACHE_CAPACITY = 32

function getBootstrapCacheState(projectRoot: string): BootstrapRetryState {
  const existing = bootstrapCache.get(projectRoot)
  if (existing) {
    // Refresh recency: re-insert so this root becomes most-recently-used.
    bootstrapCache.delete(projectRoot)
    bootstrapCache.set(projectRoot, existing)
    return existing
  }
  if (bootstrapCache.size >= BOOTSTRAP_CACHE_CAPACITY) {
    const leastRecentRoot = bootstrapCache.keys().next().value
    if (leastRecentRoot !== undefined) {
      bootstrapCache.delete(leastRecentRoot)
    }
  }
  const state: BootstrapRetryState = {
    attempts: 0,
    lastAttemptTime: 0,
    nextRetryDelay: 1000,
  }
  bootstrapCache.set(projectRoot, state)
  return state
}

export async function createSessionServices(
  context: AppRuntimeContext,
  overrides?: Parameters<typeof createAgentSessionServices>[0],
  options?: {
    userId?: string
    projectRoot?: string
    workspace?: ChatWorkspaceStatus
  }
) {
  installHarnessWriteResolver()
  if (isDeployedChatRuntimeSurface()) {
    // Capture platform Gateway creds in memory, then scrub org LLM + Gateway
    // env so bash/tools cannot read them. Chat uses BYOK rows + captured Gateway.
    captureAndScrubNeonAiGatewayEnv()
    for (const envVarName of PROVIDER_ENV_SCRUB_VAR_NAMES) {
      delete process.env[envVarName]
    }
  }

  const workspaceBootstrap = await loadBestEffortWorkspaceHealth(context)
  const databaseBacked = usesDatabaseBackedProjectSettings()
  const { hydrateSessionServicesSettings, resolveProjectSettings } =
    await import("./durable-project-settings")
  // Seed private settings before Pi's first resource reload. Deployed callers
  // cannot substitute a manager that reads or writes the shared checkout.
  const agentDir = process.env.PI_AGENT_DIR ?? getAgentDir()
  const settingsManager = databaseBacked
    ? createIsolatedProjectSettings(
        await resolveProjectSettings({ userId: options?.userId })
      )
    : (overrides?.settingsManager ??
      (options?.userId
        ? SettingsManager.create(
            context.projectRoot,
            overrides?.agentDir ?? agentDir
          )
        : undefined))
  const sandboxResources =
    settingsManager && options?.userId
      ? createSandboxResourceSettings(settingsManager, options.userId)
      : undefined
  await sandboxResources?.prepare()
  const userResourceOptions = overrides?.resourceLoaderOptions
  const services = await createAgentSessionServices({
    cwd: context.projectRoot,
    agentDir,
    ...overrides,
    settingsManager: sandboxResources?.loaderSettings ?? settingsManager,
    resourceLoaderOptions: {
      ...userResourceOptions,
      // Server-owned extensions: the Fleet Pi identity always, plus the
      // workspace-free extensions when `.pi/extensions` is not discoverable.
      extensionFactories: [
        ...buildFleetPiInlineExtensions({
          projectRoot: context.projectRoot,
          workspace: options?.workspace ?? { toolsAvailable: true },
        }),
        { name: "fleet-pi-plan-mode", factory: createPlanModeExtension() },
        ...(userResourceOptions?.extensionFactories ?? []),
      ],
      extensionsOverride: (base) => {
        const withoutStock = excludeStockDaytonaPiExtension(base)
        return userResourceOptions?.extensionsOverride
          ? userResourceOptions.extensionsOverride(withoutStock)
          : withoutStock
      },
    },
    resourceLoaderReloadOptions: {
      resolveProjectTrust: ({ extensionsResult }) =>
        resolveLoaderProjectTrust({
          extensionsResult,
          cwd: context.projectRoot,
          mode: "print",
        }),
    },
  })
  sandboxResources?.attach(services)

  const servicesWithBootstrap = attachWorkspaceBootstrap(
    services,
    workspaceBootstrap
  )

  if (!databaseBacked) {
    await hydrateSessionServicesSettings(servicesWithBootstrap, {
      userId: options?.userId,
      projectRoot: context.projectRoot,
    })
  }

  const { registerOpenAiChatCompletionsProvider } =
    await import("./openai-chat-completions-provider")
  await registerOpenAiChatCompletionsProvider(
    servicesWithBootstrap,
    options?.userId
  )

  const { registerCustomProviders } = await import("./custom-provider-registry")
  await registerCustomProviders(servicesWithBootstrap, options?.userId)

  return servicesWithBootstrap
}

export async function applyRuntimeAuth(
  services: AgentSessionServices,
  options: ApplyRuntimeAuthOptions
) {
  const { loadLlmProviderSecrets } = await import("./user-provider-secrets")
  const configured = await loadLlmProviderSecrets(options.userId)

  const { modelRuntime } = services

  // Reconcile ONLY the providers the user actually configured (BYOK rows on
  // Cloudflare, env keys locally). Do NOT sweep the whole Pi provider catalog:
  // every key mutation triggers a Pi availability refresh, and with network
  // model refresh enabled that scan walks every provider and can hang (e.g.
  // amazon-bedrock without AWS credentials).
  //
  // Pi 1.x: setRuntimeApiKey takes AuthOperationOptions (signal only) and its
  // credential sync always refreshes just this provider with
  // `allowNetwork: false`, so each per-key refresh stays offline and bounded.
  // A network refresh would need an explicit `modelRuntime.refresh({ providers })`,
  // which we deliberately never call here.
  for (const [providerId, apiKey] of configured) {
    await modelRuntime.setRuntimeApiKey(providerId, apiKey)
  }

  // Clear only runtime keys Fleet set on this session that the user no longer
  // configures (provider removed while a live runtime stays resident). Fresh
  // runtimes hold no runtime keys, so this is a no-op except after provider
  // hot-reloads.
  for (const providerId of modelRuntime.getRegisteredProviderIds()) {
    if (
      modelRuntime.getProviderAuthStatus(providerId).source === "runtime" &&
      !configured.has(providerId)
    ) {
      await modelRuntime.removeRuntimeApiKey(providerId)
    }
  }

  const { registerOpenAiChatCompletionsProvider } =
    await import("./openai-chat-completions-provider")
  await registerOpenAiChatCompletionsProvider(services, options.userId)

  const { registerCustomProviders } = await import("./custom-provider-registry")
  await registerCustomProviders(services, options.userId)
}

async function loadBestEffortWorkspaceHealth(
  context: AppRuntimeContext
): Promise<WorkspaceHealthResponse> {
  if (isHostedGitWorkspace(context)) {
    return hostedGitWorkspaceHealth(context)
  }

  const now = Date.now()
  const projectRoot = context.projectRoot
  const state = getBootstrapCacheState(projectRoot)

  // An in-flight bootstrap is shared across all requests for this project root:
  // await the single promise instead of starting another bootstrap.
  if (state.promise) {
    return state.promise
  }

  if (state.lastResult) {
    const timeSinceLastAttempt = now - state.lastAttemptTime
    if (timeSinceLastAttempt < state.nextRetryDelay) {
      return state.lastResult
    }
  }

  state.attempts++
  state.lastAttemptTime = now
  if (state.attempts > 1) {
    state.nextRetryDelay = Math.min(state.nextRetryDelay * 2, 30000)
  }

  const promise = bootstrapAgentWorkspace(context)
    .then((result) => {
      if (result.status === "ok" && result.workspace.available) {
        state.attempts = 0
        state.nextRetryDelay = 1000
      } else {
        state.lastAttemptTime = Date.now()
      }
      state.lastResult = result
      state.promise = undefined
      return result
    })
    .catch((error) => {
      const failure = createWorkspaceHealthFailure(context, error)
      state.lastResult = failure
      state.lastAttemptTime = Date.now()
      state.promise = undefined
      return failure
    })

  state.promise = promise
  return promise
}

function isHostedGitWorkspace(context: AppRuntimeContext) {
  if (!isHostedDeployment() || context.workspaceFS) return false
  return (
    context.workspaceRoot ===
    join(context.projectRoot, AGENT_WORKSPACE_DIRECTORY)
  )
}

function hostedGitWorkspaceHealth(
  context: AppRuntimeContext
): WorkspaceHealthResponse {
  const health = createWorkspaceHealthFailure(
    context,
    new Error("hosted-workspace-pending")
  )
  return { ...health, warnings: [], diagnostics: [] }
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
