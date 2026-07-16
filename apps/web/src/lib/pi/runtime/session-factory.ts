import {
  createAgentSessionServices,
  getAgentDir,
} from "@earendil-works/pi-coding-agent"
import {
  LLM_PROVIDER_ENV_SCRUB_IDS,
  PROVIDER_ENV_SCRUB_VAR_NAMES,
} from "@workspace/pi-protocol/provider-catalog"
import {
  bootstrapAgentWorkspace,
  createWorkspaceHealthFailure,
} from "../../workspace/bootstrap-agent-workspace"
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import type { WorkspaceHealthResponse } from "../../workspace/bootstrap-agent-workspace"
import type { ApplyRuntimeAuthOptions } from "./types"

type ServicesWithWorkspaceBootstrap = AgentSessionServices & {
  workspaceBootstrap?: WorkspaceHealthResponse
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

export async function createSessionServices(
  context: AppRuntimeContext,
  overrides?: Parameters<typeof createAgentSessionServices>[0]
) {
  if (process.env.VERCEL === "1") {
    for (const envVarName of PROVIDER_ENV_SCRUB_VAR_NAMES) {
      delete process.env[envVarName]
    }
  }

  const workspaceBootstrap = await loadBestEffortWorkspaceHealth(context)
  const services = await createAgentSessionServices({
    cwd: context.projectRoot,
    agentDir: process.env.PI_AGENT_DIR ?? getAgentDir(),
    ...overrides,
  })

  const servicesWithBootstrap = attachWorkspaceBootstrap(
    services,
    workspaceBootstrap
  )

  const { registerOpenAiChatCompletionsProvider } =
    await import("./openai-chat-completions-provider")
  await registerOpenAiChatCompletionsProvider(servicesWithBootstrap, undefined)

  return servicesWithBootstrap
}

export async function applyRuntimeAuth(
  services: AgentSessionServices,
  options: ApplyRuntimeAuthOptions
) {
  const { loadLlmProviderSecrets } = await import("./user-provider-secrets")
  const configured = await loadLlmProviderSecrets(options.userId)

  const authStorage = services.authStorage as {
    setRuntimeApiKey: (providerId: string, apiKey: string) => void
    removeRuntimeApiKey?: (providerId: string) => void
  }

  for (const providerId of LLM_PROVIDER_ENV_SCRUB_IDS) {
    const apiKey = configured.get(providerId)
    if (apiKey) {
      authStorage.setRuntimeApiKey(providerId, apiKey)
    } else {
      authStorage.removeRuntimeApiKey?.(providerId)
    }
  }

  const { registerOpenAiChatCompletionsProvider } =
    await import("./openai-chat-completions-provider")
  await registerOpenAiChatCompletionsProvider(services, options.userId)
}

async function loadBestEffortWorkspaceHealth(
  context: AppRuntimeContext
): Promise<WorkspaceHealthResponse> {
  const now = Date.now()
  let state = bootstrapRetryStates.get(context)

  if (!state) {
    state = {
      attempts: 0,
      lastAttemptTime: 0,
      nextRetryDelay: 1000,
    }
    bootstrapRetryStates.set(context, state)
  }

  if (context.workspaceBootstrap) {
    try {
      const result = await context.workspaceBootstrap
      if (result.status === "ok" && result.workspace.available) {
        state.attempts = 0
        state.nextRetryDelay = 1000
        state.lastResult = result
        return result
      }
      state.lastResult = result
    } catch (error) {
      const failure = createWorkspaceHealthFailure(context, error)
      state.lastResult = failure
    }
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
      return result
    })
    .catch((error) => {
      const failure = createWorkspaceHealthFailure(context, error)
      state.lastResult = failure
      state.lastAttemptTime = Date.now()
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
