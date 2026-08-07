import {
  createAgentSessionServices,
  getAgentDir,
} from "@earendil-works/pi-coding-agent"
import { PROVIDER_ENV_SCRUB_VAR_NAMES } from "@workspace/pi-protocol/provider-catalog"
import {
  bootstrapAgentWorkspace,
  createWorkspaceHealthFailure,
} from "../../workspace/bootstrap-agent-workspace"
import { excludeStockDaytonaPiExtension } from "../exclude-stock-daytona-pi"
import { isDeployedChatRuntimeSurface } from "./deployed-chat-runtime"
import { captureAndScrubNeonAiGatewayEnv } from "./neon-ai-gateway"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import type { WorkspaceHealthResponse } from "../../workspace/bootstrap-agent-workspace"
import type { ApplyRuntimeAuthOptions } from "./types"

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
  options?: { userId?: string; projectRoot?: string }
) {
  if (isDeployedChatRuntimeSurface()) {
    // Capture platform Gateway creds in memory, then scrub org LLM + Gateway
    // env so bash/tools cannot read them. Chat uses BYOK rows + captured Gateway.
    captureAndScrubNeonAiGatewayEnv()
    for (const envVarName of PROVIDER_ENV_SCRUB_VAR_NAMES) {
      delete process.env[envVarName]
    }
  }

  const workspaceBootstrap = await loadBestEffortWorkspaceHealth(context)
  const userResourceOptions = overrides?.resourceLoaderOptions
  const services = await createAgentSessionServices({
    cwd: context.projectRoot,
    agentDir: process.env.PI_AGENT_DIR ?? getAgentDir(),
    ...overrides,
    resourceLoaderOptions: {
      ...userResourceOptions,
      extensionsOverride: (base) => {
        const withoutStock = excludeStockDaytonaPiExtension(base)
        return userResourceOptions?.extensionsOverride
          ? userResourceOptions.extensionsOverride(withoutStock)
          : withoutStock
      },
    },
  })

  const servicesWithBootstrap = attachWorkspaceBootstrap(
    services,
    workspaceBootstrap
  )

  const { hydrateSessionServicesSettings } =
    await import("./durable-project-settings")
  await hydrateSessionServicesSettings(servicesWithBootstrap, {
    userId: options?.userId,
    projectRoot: context.projectRoot,
  })

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
  // Vercel, env keys locally). Do NOT sweep the whole Pi provider catalog:
  // every key mutation triggers a Pi availability refresh, and with network
  // model refresh enabled that scan walks every provider and can hang (e.g.
  // amazon-bedrock without AWS credentials). `allowNetwork: false` keeps each
  // per-key refresh offline and bounded.
  for (const [providerId, apiKey] of configured) {
    await modelRuntime.setRuntimeApiKey(providerId, apiKey, {
      allowNetwork: false,
    })
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

function attachWorkspaceBootstrap(
  services: AgentSessionServices,
  workspaceBootstrap: WorkspaceHealthResponse
) {
  const servicesWithWorkspaceBootstrap =
    services as ServicesWithWorkspaceBootstrap
  servicesWithWorkspaceBootstrap.workspaceBootstrap = workspaceBootstrap
  return servicesWithWorkspaceBootstrap
}
