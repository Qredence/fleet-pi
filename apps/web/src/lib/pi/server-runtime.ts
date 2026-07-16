import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createBashToolDefinition,
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  getAgentDir,
} from "@earendil-works/pi-coding-agent"
import {
  CHAT_TOOL_ALLOWLIST,
  answerPlanDecision,
  applyPlanMode,
  clearPlanModeSession,
  createPlanModeExtension,
  createPlanToolPart,
  getPlanState,
  isPlanDecisionToolCall,
  resolveQuestionnaireAnswer,
} from "./plan-mode"
import {
  createSessionCircuitBreaker,
  createSessionFallbackError,
} from "./circuit-breaker"
import { applyModelSelection, resolveModelSelection } from "./runtime"
import {
  collectDiagnostics,
  createSessionServices,
  getSessionDir,
  safeRealpath,
} from "./server-shared"
import {
  deleteActiveSessionRecord,
  getActiveSessionRecords,
  hasOtherActiveSessionForUser,
  setActiveSessionRecord,
} from "./runtime/active-sessions"
import { resolveDaytonaRuntimeApiKey } from "./runtime/user-provider-secrets"
import { applyRuntimeAuth } from "./runtime/session-factory"
import { createSessionManager, isUsableSessionFile } from "./server-sessions"
import type { ActiveSessionRecord } from "./runtime/active-sessions"
import type {
  AgentSessionRuntime,
  CreateAgentSessionRuntimeFactory,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent"
import type {
  ChatMode,
  ChatModelSelection,
  ChatPlanAction,
  ChatQuestionAnswerRequest,
  ChatQuestionAnswerResponse,
  ChatSessionMetadata,
} from "@workspace/pi-protocol/chat-protocol"
import type { AppRuntimeContext } from "@/lib/app-runtime"
import {
  isDaytonaEnabled,
  releaseUserSandbox,
} from "@/lib/daytona/user-sandbox"
import { resolveUserSandboxContext } from "@/lib/daytona/resolve-user-sandbox-context"
import { createSandboxOperations } from "@/lib/daytona/sandbox-operations"
import {
  trackDaytonaToolSession,
  untrackDaytonaToolSession,
} from "@/lib/daytona/tool-context"

const DEFAULT_RUNTIME_TTL_MS = 600_000

function resolveRuntimeTtlMs(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return DEFAULT_RUNTIME_TTL_MS
  }

  const parsed = Number.parseInt(trimmed, 10)
  return Number.isSafeInteger(parsed) ? parsed : DEFAULT_RUNTIME_TTL_MS
}

const RUNTIME_TTL_MS = resolveRuntimeTtlMs(process.env.FLEET_PI_RUNTIME_TTL_MS)

type ChatRuntimeMetadata = ChatSessionMetadata & {
  mode?: ChatMode
  planAction?: ChatPlanAction
  userId?: string
  userEmail?: string
}

const runtimeRecords = getActiveSessionRecords()

async function invokeAgentSessionCreation(
  params: Parameters<typeof createAgentSessionFromServices>[0]
) {
  return createAgentSessionFromServices(params)
}

const sessionCircuitBreaker = createSessionCircuitBreaker(
  invokeAgentSessionCreation
)

sessionCircuitBreaker.fallback(() => {
  throw createSessionFallbackError()
})

export function retainPiRuntime(runtime: AgentSessionRuntime, userId?: string) {
  const record = trackRuntime(runtime, userId)
  if (record.disposeTimer) {
    clearTimeout(record.disposeTimer)
    record.disposeTimer = undefined
  }

  return () => {
    scheduleRuntimeDisposal(record)
  }
}

export async function abortActiveSession(metadata: ChatRuntimeMetadata) {
  const active = findRuntimeRecord(metadata)
  if (!active) return false

  const { session } = active.runtime
  if (!session.isStreaming) return false

  session.abortBash()
  session.abortRetry()
  session.abortCompaction()
  await session.abort()
  return true
}

export function evictPiRuntimeForDeletedSession(input: {
  sessionId: string
  sessionFile?: string
  userId?: string
}) {
  const active =
    runtimeRecords.get(input.sessionId) ??
    findRuntimeRecord({
      sessionId: input.sessionId,
      sessionFile: input.sessionFile,
      userId: input.userId,
    })
  if (!active) return

  disposeRuntimeRecord(active)
}

export function evictAllPiRuntimesForUser(userId: string) {
  for (const record of [...runtimeRecords.values()]) {
    if (record.userId === userId) {
      disposeRuntimeRecord(record)
    }
  }
}

function disposeRuntimeRecord(record: ActiveSessionRecord) {
  if (record.disposeTimer) {
    clearTimeout(record.disposeTimer)
    record.disposeTimer = undefined
  }

  clearPlanModeSession(record.sessionId)
  deleteActiveSessionRecord(record.sessionId)
  untrackDaytonaToolSession(record.sessionId, record.sessionFile)
  if (
    record.userId &&
    !hasOtherActiveSessionForUser(record.userId, record.sessionId)
  ) {
    void releaseUserSandbox(record.userId)
  }
  void record.runtime.dispose()
}

export async function queuePromptOnActiveSession(
  metadata: ChatRuntimeMetadata,
  prompt: string,
  streamingBehavior: "steer" | "followUp"
) {
  const active = findRuntimeRecord(metadata)
  const session = active?.runtime.session
  if (!session?.isStreaming) return undefined

  await session.prompt(prompt, {
    expandPromptTemplates: true,
    streamingBehavior,
  })

  return {
    steering: [...session.getSteeringMessages()],
    followUp: [...session.getFollowUpMessages()],
  }
}

export async function createPiRuntime(
  context: AppRuntimeContext,
  metadata: ChatRuntimeMetadata,
  modelSelection?: ChatModelSelection
) {
  const daytonaApiKey = await resolveDaytonaRuntimeApiKey(metadata.userId)
  if (
    isDaytonaEnabled(metadata.userId, daytonaApiKey) &&
    !context.workspaceFS
  ) {
    const sandboxContext = await resolveUserSandboxContext({
      userId: metadata.userId!,
      userEmail: metadata.userEmail,
      apiKey: daytonaApiKey!,
      surface: "chat",
    })
    context.workspaceFS = sandboxContext.workspaceFS
    context.workspaceRoot = sandboxContext.workspaceRoot
    context.workspaceBootstrap = undefined
  }

  const services = await createSessionServices(context)
  const requestDiagnostics = collectDiagnostics(services)
  const sessionDir = getSessionDir(context.projectRoot, services, {
    userId: metadata.userId,
  })
  const mayReuseRuntime =
    !metadata.sessionFile ||
    isUsableSessionFile(metadata.sessionFile, sessionDir)
  const reusable = mayReuseRuntime ? findRuntimeRecord(metadata) : undefined

  if (reusable) {
    if (reusable.disposeTimer) {
      clearTimeout(reusable.disposeTimer)
      reusable.disposeTimer = undefined
    }
    reusable.lastUsedAt = Date.now()
    try {
      await applyModelSelection(reusable.runtime, modelSelection)
      applyPlanMode(reusable.runtime, metadata.mode, metadata.planAction)
    } catch (error) {
      scheduleRuntimeDisposal(reusable)
      throw error
    }
    return {
      runtime: reusable.runtime,
      sessionReset: false,
      diagnostics: mergeDiagnostics(
        requestDiagnostics,
        collectDiagnostics(
          reusable.runtime.services,
          reusable.runtime.modelFallbackMessage
        )
      ),
    }
  }

  const { sessionManager, sessionReset } = await createSessionManager(
    metadata,
    context.projectRoot,
    sessionDir,
    { userId: metadata.userId }
  )
  const createRuntime: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir: runtimeAgentDir,
    sessionManager: runtimeSessionManager,
    sessionStartEvent,
  }) => {
    const runtimeServices = await createSessionServices(context, {
      cwd,
      agentDir: runtimeAgentDir,
      resourceLoaderOptions: {
        extensionFactories: [createPlanModeExtension()],
      },
    })
    const { model, thinkingLevel } = resolveModelSelection(
      runtimeServices,
      modelSelection
    )

    await applyRuntimeAuth(runtimeServices, { userId: metadata.userId })

    let customTools: Array<ToolDefinition> | undefined
    const runtimeDaytonaApiKey = await resolveDaytonaRuntimeApiKey(
      metadata.userId
    )
    if (isDaytonaEnabled(metadata.userId, runtimeDaytonaApiKey)) {
      const sandboxContext = await resolveUserSandboxContext({
        userId: metadata.userId!,
        userEmail: metadata.userEmail,
        apiKey: runtimeDaytonaApiKey!,
        surface: "chat",
      })
      const sandboxCwd = sandboxContext.sandboxProjectRoot
      const s = sandboxContext.sandbox
      const ops = createSandboxOperations(s)
      customTools = [
        createBashToolDefinition(sandboxCwd, { operations: ops.bash }),
        createReadToolDefinition(sandboxCwd, { operations: ops.read }),
        createWriteToolDefinition(sandboxCwd, { operations: ops.write }),
        createEditToolDefinition(sandboxCwd, { operations: ops.edit }),
        createGrepToolDefinition(sandboxCwd, { operations: ops.grep }),
        createFindToolDefinition(sandboxCwd, { operations: ops.find }),
        createLsToolDefinition(sandboxCwd, { operations: ops.ls }),
      ] as Array<ToolDefinition>
    }

    const result = await sessionCircuitBreaker.fire({
      services: runtimeServices,
      sessionManager: runtimeSessionManager,
      sessionStartEvent,
      model,
      thinkingLevel,
      tools: CHAT_TOOL_ALLOWLIST,
      customTools,
    })

    return {
      ...result,
      services: runtimeServices,
      diagnostics: runtimeServices.diagnostics,
    }
  }
  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: context.projectRoot,
    agentDir: process.env.PI_AGENT_DIR ?? getAgentDir(),
    sessionManager,
  })
  trackRuntime(runtime, metadata.userId)
  applyPlanMode(runtime, metadata.mode, metadata.planAction)

  return {
    runtime,
    diagnostics: collectDiagnostics(
      runtime.services,
      runtime.modelFallbackMessage
    ),
    sessionReset,
  }
}

function mergeDiagnostics(...diagnosticLists: Array<Array<string>>) {
  return [...new Set(diagnosticLists.flat())]
}

export function answerChatQuestion(
  request: ChatQuestionAnswerRequest
): ChatQuestionAnswerResponse {
  if (isPlanDecisionToolCall(request.toolCallId)) {
    const active = findRuntimeRecord(request)
    if (!active) {
      return {
        ok: false,
        message:
          "Plan session is no longer active. Send a new message to continue.",
      }
    }
    if (
      !matchesPendingPlanDecisionToolCall(active.runtime, request.toolCallId)
    ) {
      return {
        ok: false,
        message: "Plan question is no longer active.",
      }
    }
    return answerPlanDecision(active.runtime, request.answer)
  }

  const ok = resolveQuestionnaireAnswer(request.toolCallId, request.answer)
  return ok
    ? { ok: true }
    : {
        ok: false,
        message: "Question is no longer active.",
      }
}

function findRuntimeRecord(metadata: ChatRuntimeMetadata) {
  const matchesUser = (active: ActiveSessionRecord) =>
    metadata.userId === undefined || active.userId === metadata.userId

  if (metadata.sessionFile) {
    const requested = safeRealpath(metadata.sessionFile)
    if (!requested) {
      if (!metadata.sessionId) return undefined
      const active = runtimeRecords.get(metadata.sessionId)
      if (!active?.sessionFile) return undefined

      return active.sessionFile === metadata.sessionFile && matchesUser(active)
        ? active
        : undefined
    }

    for (const active of runtimeRecords.values()) {
      if (
        active.sessionFile &&
        matchesUser(active) &&
        (active.sessionFile === metadata.sessionFile ||
          safeRealpath(active.sessionFile) === requested)
      ) {
        return active
      }
    }

    return undefined
  }

  if (!metadata.sessionId) return undefined
  const active = runtimeRecords.get(metadata.sessionId)
  return active && matchesUser(active) ? active : undefined
}

function trackRuntime(runtime: AgentSessionRuntime, userId?: string) {
  const session = runtime.session
  const record =
    runtimeRecords.get(session.sessionId) ??
    ({
      runtime,
      sessionFile: session.sessionFile,
      sessionId: session.sessionId,
      lastUsedAt: Date.now(),
    } satisfies ActiveSessionRecord)

  record.runtime = runtime
  record.sessionFile = session.sessionFile
  record.sessionId = session.sessionId
  record.lastUsedAt = Date.now()
  if (userId) record.userId = userId
  trackDaytonaToolSession(session.sessionId, session.sessionFile, userId)
  setActiveSessionRecord(session.sessionId, record)
  return record
}

function scheduleRuntimeDisposal(record: ActiveSessionRecord) {
  record.lastUsedAt = Date.now()
  if (record.disposeTimer) {
    clearTimeout(record.disposeTimer)
    record.disposeTimer = undefined
  }

  record.disposeTimer = setTimeout(
    () => {
      const current = runtimeRecords.get(record.sessionId)
      if (
        !current ||
        current !== record ||
        current.runtime.session.isStreaming
      ) {
        return
      }

      const timeSinceLastUsed = Date.now() - current.lastUsedAt
      if (timeSinceLastUsed < RUNTIME_TTL_MS) {
        scheduleRuntimeDisposal(current)
        return
      }

      const finalCheck = runtimeRecords.get(record.sessionId)
      if (
        !finalCheck ||
        finalCheck !== record ||
        finalCheck.runtime.session.isStreaming
      ) {
        return
      }

      disposeRuntimeRecord(record)
    },
    Math.max(0, RUNTIME_TTL_MS)
  )
}

function matchesPendingPlanDecisionToolCall(
  runtime: AgentSessionRuntime,
  toolCallId: string | undefined
) {
  if (!toolCallId) return false

  const state = getPlanState(runtime)
  if (!state.pendingDecision || state.todos.length === 0) return false

  return (
    createPlanToolPart("pending-plan-decision", state)?.toolCallId ===
    toolCallId
  )
}
