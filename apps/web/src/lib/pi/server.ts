import { existsSync, mkdirSync, realpathSync } from "node:fs"
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
} from "node:path"
import {
  SessionManager,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
} from "@mariozechner/pi-coding-agent"
import {
  CHAT_TOOL_ALLOWLIST,
  answerPlanDecision,
  applyPlanMode,
  createPlanModeExtension,
  isPlanDecisionToolCall,
  normalizeQuestionInput,
  normalizeQuestionOutput,
  resolveQuestionnaireAnswer,
} from "./plan-mode"
import {
  createBedrockCircuitBreaker,
  createBedrockFallbackError,
} from "./circuit-breaker"
import { collectResourceExpectationDiagnostics } from "./resource-expectations"
import type {
  AgentSessionEvent,
  AgentSessionRuntime,
  AgentSessionServices,
  CreateAgentSessionRuntimeFactory,
  PromptTemplate,
  SessionEntry,
  Skill,
} from "@mariozechner/pi-coding-agent"
import type { Model } from "@mariozechner/pi-ai"
import type {
  ChatMessage,
  ChatMessagePart,
  ChatToolPart,
} from "@workspace/ui/components/agent-elements/chat-types"
import type {
  ChatMode,
  ChatModelInfo,
  ChatModelSelection,
  ChatModelsResponse,
  ChatPlanAction,
  ChatQuestionAnswerRequest,
  ChatQuestionAnswerResponse,
  ChatResourcesResponse,
  ChatSessionInfo,
  ChatSessionMetadata,
  ChatSessionResponse,
  ChatThinkingLevel,
} from "./chat-protocol"
import type { AppRuntimeContext } from "@/lib/app-runtime"

const DEFAULT_BEDROCK_MODEL = "us.anthropic.claude-sonnet-4-6"
const RUNTIME_TTL_MS = Number(process.env.FLEET_PI_RUNTIME_TTL_MS ?? 600_000)
const THINKING_LEVELS = new Set<ChatThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
])

type SessionAgentMessage = Extract<SessionEntry, { type: "message" }>["message"]

type SessionManagerResult = {
  sessionManager: SessionManager
  sessionReset: boolean
}

type ChatRuntimeMetadata = ChatSessionMetadata & {
  mode?: ChatMode
  planAction?: ChatPlanAction
}

type ActiveSessionRecord = {
  runtime: AgentSessionRuntime
  sessionFile?: string
  sessionId: string
  lastUsedAt: number
  disposeTimer?: ReturnType<typeof setTimeout>
}

async function invokeBedrockAgentSession(
  params: Parameters<typeof createAgentSessionFromServices>[0]
) {
  return createAgentSessionFromServices(params)
}

const bedrockCircuitBreaker = createBedrockCircuitBreaker(
  invokeBedrockAgentSession
)

bedrockCircuitBreaker.fallback(() => {
  throw createBedrockFallbackError()
})

const runtimeRecords = new Map<string, ActiveSessionRecord>()

export function encodeEvent(event: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export function retainPiRuntime(runtime: AgentSessionRuntime) {
  const record = trackRuntime(runtime)
  if (record.disposeTimer) {
    clearTimeout(record.disposeTimer)
    record.disposeTimer = undefined
  }

  return () => {
    scheduleRuntimeDisposal(record)
  }
}

export async function abortActiveSession(metadata: ChatSessionMetadata) {
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

export async function queuePromptOnActiveSession(
  metadata: ChatSessionMetadata,
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
  const services = await createSessionServices(context)
  const sessionDir = getSessionDir(context, context.projectRoot, services)
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
    await applyModelSelection(reusable.runtime, modelSelection)
    applyPlanMode(reusable.runtime, metadata.mode, metadata.planAction)
    return {
      runtime: reusable.runtime,
      sessionReset: false,
      diagnostics: collectDiagnostics(
        reusable.runtime.services,
        reusable.runtime.modelFallbackMessage
      ),
    }
  }

  const { sessionManager, sessionReset } = await createSessionManager(
    metadata,
    context.projectRoot,
    sessionDir
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
    const result = await bedrockCircuitBreaker.fire({
      services: runtimeServices,
      sessionManager: runtimeSessionManager,
      sessionStartEvent,
      model,
      thinkingLevel,
      // Pi exposes an allowlist of active tool names here. The SDK also
      // exports createCodingTools(cwd), but createAgentSession* expects names.
      tools: CHAT_TOOL_ALLOWLIST,
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
  trackRuntime(runtime)
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

export async function createNewChatSession(
  context: AppRuntimeContext
): Promise<ChatSessionResponse> {
  const services = await createSessionServices(context)
  const sessionManager = SessionManager.create(
    context.projectRoot,
    getSessionDir(context, context.projectRoot, services)
  )

  return {
    session: toSessionMetadata(sessionManager),
    messages: [],
  }
}

export async function hydrateChatSession(
  context: AppRuntimeContext,
  metadata: ChatSessionMetadata
): Promise<ChatSessionResponse> {
  const services = await createSessionServices(context)
  const sessionDir = getSessionDir(context, context.projectRoot, services)
  const sessionFile = await resolveSessionFile(
    metadata,
    context.projectRoot,
    sessionDir
  )

  if (!sessionFile) {
    const sessionManager = SessionManager.create(
      context.projectRoot,
      sessionDir
    )
    return {
      session: toSessionMetadata(sessionManager),
      messages: [],
      sessionReset: Boolean(metadata.sessionFile || metadata.sessionId),
    }
  }

  const sessionManager = openSessionManager(
    sessionFile,
    sessionDir,
    context.projectRoot
  )
  if (!sessionManager) {
    const fresh = SessionManager.create(context.projectRoot, sessionDir)
    return {
      session: toSessionMetadata(fresh),
      messages: [],
      sessionReset: true,
    }
  }

  return {
    session: toSessionMetadata(sessionManager),
    messages: sessionEntriesToChatMessages(sessionManager.getBranch()),
  }
}

export async function listChatSessions(
  context: AppRuntimeContext
): Promise<Array<ChatSessionInfo>> {
  const services = await createSessionServices(context)
  const sessions = await SessionManager.list(
    context.projectRoot,
    getSessionDir(context, context.projectRoot, services)
  )

  return sessions.map((session) => ({
    path: session.path,
    id: session.id,
    cwd: session.cwd,
    name: session.name,
    created: session.created.toISOString(),
    modified: session.modified.toISOString(),
    messageCount: session.messageCount,
    firstMessage: session.firstMessage,
  }))
}

export async function loadChatModels(
  context: AppRuntimeContext
): Promise<ChatModelsResponse> {
  const services = await createSessionServices(context)
  const available = services.modelRegistry.getAvailable()
  const availableKeys = new Set(available.map(modelKey))
  const all = services.modelRegistry.getAll()
  const models = (available.length > 0 ? available : all).map((model) =>
    toChatModelInfo(
      model,
      available.length === 0 || availableKeys.has(modelKey(model)),
      services.settingsManager.getDefaultThinkingLevel()
    )
  )
  const defaultProvider =
    services.settingsManager.getDefaultProvider() ?? "amazon-bedrock"
  const defaultModel =
    services.settingsManager.getDefaultModel() ?? DEFAULT_BEDROCK_MODEL
  const defaultThinkingLevel = normalizeThinkingLevel(
    services.settingsManager.getDefaultThinkingLevel()
  )
  const selected =
    models.find(
      (model) => model.provider === defaultProvider && model.id === defaultModel
    ) ??
    (defaultProvider === "amazon-bedrock"
      ? findChatModelByCandidates(models, bedrockModelCandidates(defaultModel))
      : undefined) ??
    models[0]

  return {
    models,
    selectedModelKey: selected.key,
    defaultProvider,
    defaultModel,
    defaultThinkingLevel,
    diagnostics: collectDiagnostics(services),
  }
}

export async function loadChatResources(
  context: AppRuntimeContext
): Promise<ChatResourcesResponse> {
  const services = await createSessionServices(context)
  const skills = services.resourceLoader.getSkills()
  const prompts = services.resourceLoader.getPrompts()
  const extensions = services.resourceLoader.getExtensions()
  const themes = services.resourceLoader.getThemes()
  const agentsFiles = services.resourceLoader.getAgentsFiles()

  const response: ChatResourcesResponse = {
    skills: skills.skills.map(skillToResourceInfo),
    prompts: prompts.prompts.map(promptToResourceInfo),
    extensions: extensions.extensions.map((extension) => ({
      name: extensionNameFromPath(extension.path),
      path: extension.resolvedPath,
      source: getSource(extension),
    })),
    themes: themes.themes.map((theme) => {
      const resource = theme as unknown as Record<string, unknown>
      return {
        name: stringValue(resource.name) ?? stringValue(resource.id) ?? "Theme",
        path: stringValue(resource.filePath) ?? stringValue(resource.path),
      }
    }),
    agentsFiles: agentsFiles.agentsFiles.map((file) => ({
      name: basename(file.path),
      path: file.path,
    })),
    diagnostics: collectDiagnostics(services),
  }

  return {
    ...response,
    diagnostics: [
      ...new Set([
        ...response.diagnostics,
        ...collectResourceExpectationDiagnostics(response),
      ]),
    ],
  }
}

function extensionNameFromPath(path: string | undefined) {
  if (!path) return "Resource"

  const fileName = basename(path)
  if (fileName.toLowerCase() === "index.ts") {
    return basename(dirname(path))
  }

  const extension = extname(fileName)
  return extension ? fileName.slice(0, -extension.length) : fileName
}

export function toToolPart(
  event: Extract<
    AgentSessionEvent,
    {
      type:
        | "tool_execution_start"
        | "tool_execution_update"
        | "tool_execution_end"
    }
  >,
  fallbackInput?: Record<string, unknown>
): ChatToolPart {
  const toolName = normalizeToolName(event.toolName)
  const input = normalizeToolInput(
    toolName,
    "args" in event ? event.args : (fallbackInput ?? {})
  )
  const rawOutput =
    event.type === "tool_execution_update"
      ? event.partialResult
      : event.type === "tool_execution_end"
        ? event.result
        : undefined
  const isError = event.type === "tool_execution_end" ? event.isError : false

  return {
    type: `tool-${toolName}`,
    toolCallId: event.toolCallId,
    state:
      event.type === "tool_execution_start"
        ? "input-available"
        : event.type === "tool_execution_update"
          ? "input-available"
          : isError
            ? "output-error"
            : "output-available",
    input,
    ...(rawOutput === undefined
      ? {}
      : { output: normalizeToolOutput(toolName, input, rawOutput, isError) }),
  }
}

export function upsertToolPart(
  parts: Array<ChatMessagePart>,
  part: ChatToolPart
) {
  const index = parts.findIndex(
    (current) =>
      current.type === part.type &&
      "toolCallId" in current &&
      current.toolCallId === part.toolCallId
  )

  if (index === -1) {
    const textIndex = parts.findIndex((current) => current.type === "text")
    if (textIndex === -1) return [...parts, part]

    return [...parts.slice(0, textIndex), part, ...parts.slice(textIndex)]
  }

  const next = [...parts]
  next[index] = { ...next[index], ...part }
  return next
}

export function appendTextPart(parts: Array<ChatMessagePart>, delta: string) {
  const index = parts.findIndex((part) => part.type === "text")
  if (index === -1) return [...parts, { type: "text", text: delta }]

  const next = [...parts]
  const part = next[index]
  next[index] =
    part.type === "text" ? { ...part, text: `${part.text}${delta}` } : part
  return next
}

export function upsertThinkingPart(
  parts: Array<ChatMessagePart>,
  text: string,
  toolCallId = "thinking"
) {
  return upsertToolPart(parts, {
    type: "tool-Thinking",
    toolCallId,
    state: "input-streaming",
    input: { thought: text },
    output: text,
  })
}

export function toChatMessage(
  id: string,
  role: ChatMessage["role"],
  parts: Array<ChatMessagePart>,
  createdAt: number = Date.now()
): ChatMessage {
  return {
    id,
    role,
    createdAt,
    parts: parts.length > 0 ? parts : [{ type: "text", text: "" }],
  }
}

function findRuntimeRecord(metadata: ChatSessionMetadata) {
  if (metadata.sessionId) {
    const active = runtimeRecords.get(metadata.sessionId)
    if (active) return active
  }

  if (!metadata.sessionFile) return undefined
  const requested = safeRealpath(metadata.sessionFile)
  if (!requested) return undefined

  for (const active of runtimeRecords.values()) {
    if (active.sessionFile && safeRealpath(active.sessionFile) === requested) {
      return active
    }
  }

  return undefined
}

function trackRuntime(runtime: AgentSessionRuntime) {
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
  runtimeRecords.set(session.sessionId, record)
  return record
}

function scheduleRuntimeDisposal(record: ActiveSessionRecord) {
  record.lastUsedAt = Date.now()
  if (record.disposeTimer) clearTimeout(record.disposeTimer)

  record.disposeTimer = setTimeout(
    () => {
      const current = runtimeRecords.get(record.sessionId)
      if (current !== record || current.runtime.session.isStreaming) return

      runtimeRecords.delete(record.sessionId)
      void current.runtime.dispose()
    },
    Math.max(0, RUNTIME_TTL_MS)
  )
}

async function createSessionServices(
  context: AppRuntimeContext,
  overrides?: Parameters<typeof createAgentSessionServices>[0]
) {
  return createAgentSessionServices({
    cwd: context.projectRoot,
    agentDir: process.env.PI_AGENT_DIR ?? getAgentDir(),
    ...overrides,
  })
}

function getSessionDir(
  _context: AppRuntimeContext,
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

function getDefaultRepoSessionDir(repoRoot: string) {
  return resolve(repoRoot, ".fleet", "sessions")
}

async function createSessionManager(
  metadata: ChatSessionMetadata,
  repoRoot: string,
  sessionDir: string
): Promise<SessionManagerResult> {
  const sessionFile = await resolveSessionFile(metadata, repoRoot, sessionDir)
  const createFreshSession = (sessionReset: boolean) => ({
    sessionManager: SessionManager.create(repoRoot, sessionDir),
    sessionReset,
  })

  if (!sessionFile) {
    return createFreshSession(
      Boolean(metadata.sessionFile || metadata.sessionId)
    )
  }

  const opened = openSessionManager(sessionFile, sessionDir, repoRoot)
  if (!opened) return createFreshSession(true)

  return { sessionManager: opened, sessionReset: false }
}

async function resolveSessionFile(
  metadata: ChatSessionMetadata,
  repoRoot: string,
  sessionDir: string
) {
  const fromFile = metadata.sessionFile
  if (fromFile && isUsableSessionFile(fromFile, sessionDir)) {
    return resolve(fromFile)
  }

  if (!metadata.sessionId) return undefined

  const sessions = await SessionManager.list(repoRoot, sessionDir)
  const match = sessions.find((session) => session.id === metadata.sessionId)
  if (!match || !isUsableSessionFile(match.path, sessionDir)) {
    return undefined
  }

  return match.path
}

function isUsableSessionFile(sessionFile: string, sessionDir: string) {
  const resolvedSessionFile = resolve(sessionFile)
  if (!existsSync(resolvedSessionFile)) return false

  const realSessionDir = safeRealpath(sessionDir)
  const realSessionFile = safeRealpath(resolvedSessionFile)
  if (!realSessionDir || !realSessionFile) return false

  return isPathInside(realSessionDir, realSessionFile)
}

function openSessionManager(
  sessionFile: string,
  sessionDir: string,
  repoRoot: string
) {
  try {
    return SessionManager.open(sessionFile, sessionDir, repoRoot)
  } catch {
    return undefined
  }
}

function isPathInside(parent: string, child: string) {
  const path = relative(parent, child)
  return path === "" || (!path.startsWith("..") && !isAbsolute(path))
}

function safeRealpath(path: string) {
  try {
    return realpathSync(resolve(path))
  } catch {
    return undefined
  }
}

function toSessionMetadata(
  sessionManager: SessionManager
): ChatSessionMetadata {
  return {
    sessionFile: sessionManager.getSessionFile(),
    sessionId: sessionManager.getSessionId(),
  }
}

async function applyModelSelection(
  runtime: AgentSessionRuntime,
  selection?: ChatModelSelection
) {
  const { model, thinkingLevel } = resolveModelSelection(
    runtime.services,
    selection
  )

  if (
    model &&
    runtime.session.model &&
    modelKey(runtime.session.model) !== modelKey(model)
  ) {
    await runtime.session.setModel(model)
  } else if (model && !runtime.session.model) {
    await runtime.session.setModel(model)
  }

  if (thinkingLevel) {
    runtime.session.setThinkingLevel(thinkingLevel)
  }
}

function resolveModelSelection(
  services: AgentSessionServices,
  selection?: ChatModelSelection
) {
  if (!selection) return {}

  const thinkingLevel =
    typeof selection === "object"
      ? normalizeThinkingLevel(selection.thinkingLevel)
      : undefined
  const model =
    typeof selection === "string"
      ? resolveLegacyModelSelection(services, selection)
      : resolveStructuredModelSelection(
          services,
          selection.provider,
          selection.id
        )

  return { model, thinkingLevel }
}

function resolveLegacyModelSelection(
  services: AgentSessionServices,
  selection: string
) {
  const [provider, ...modelParts] = selection.split("/")
  if (provider && modelParts.length > 0) {
    const model = services.modelRegistry.find(provider, modelParts.join("/"))
    if (model) return model
  }

  const withoutRegionPrefix = selection.replace(/^(us|eu|au|global)\./, "")
  const withoutSuffix = selection.replace(/\[[^\]]+\]$/, "")
  const normalized = withoutRegionPrefix.replace(/\[[^\]]+\]$/, "")
  const candidates = bedrockModelCandidates(selection, [
    withoutSuffix,
    withoutRegionPrefix,
    normalized,
  ])
  const all = services.modelRegistry.getAll()

  return (
    candidates
      .map((candidate) =>
        all.find(
          (model) =>
            model.provider === "amazon-bedrock" && model.id === candidate
        )
      )
      .find((model): model is Model<any> => model !== undefined) ??
    candidates
      .map((candidate) => all.find((model) => model.id === candidate))
      .find((model): model is Model<any> => model !== undefined)
  )
}

function resolveStructuredModelSelection(
  services: AgentSessionServices,
  provider: string,
  id: string
) {
  if (provider !== "amazon-bedrock") {
    return services.modelRegistry.find(provider, id)
  }

  return bedrockModelCandidates(id)
    .map((candidate) => services.modelRegistry.find(provider, candidate))
    .find((model): model is Model<any> => model !== undefined)
}

function bedrockModelCandidates(id: string, extra: Array<string> = []) {
  const hasRegionPrefix = /^(us|eu|au|global)\./.test(id)
  const normalized = id.replace(/^(us|eu|au|global)\./, "")
  const candidates = hasRegionPrefix
    ? [id, normalized, ...extra]
    : [`us.${id}`, `global.${id}`, id, ...extra]
  return [...new Set(candidates)]
}

function findChatModelByCandidates(
  models: Array<ChatModelInfo>,
  candidates: Array<string>
) {
  return candidates
    .map((candidate) => models.find((model) => model.id === candidate))
    .find((model): model is ChatModelInfo => model !== undefined)
}

function normalizeThinkingLevel(value: unknown): ChatThinkingLevel | undefined {
  return typeof value === "string" &&
    THINKING_LEVELS.has(value as ChatThinkingLevel)
    ? (value as ChatThinkingLevel)
    : undefined
}

function modelKey(model: Pick<Model<any>, "provider" | "id">) {
  return `${model.provider}/${model.id}`
}

function toChatModelInfo(
  model: Model<any>,
  available: boolean,
  defaultThinkingLevel: string | undefined
): ChatModelInfo {
  return {
    key: modelKey(model),
    provider: model.provider,
    id: model.id,
    name: model.name,
    reasoning: Boolean(model.reasoning),
    input: model.input,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    available,
    defaultThinkingLevel: normalizeThinkingLevel(defaultThinkingLevel),
  }
}

function skillToResourceInfo(skill: Skill) {
  return {
    name: skill.name,
    description: skill.description,
    path: skill.filePath,
    source: getSource(skill),
  }
}

function promptToResourceInfo(prompt: PromptTemplate) {
  return {
    name: prompt.name,
    description: prompt.description,
    path: prompt.filePath,
    source: getSource(prompt),
    argumentHint: prompt.argumentHint,
  }
}

function getSource(resource: { sourceInfo?: unknown }) {
  const sourceInfo = resource.sourceInfo
  if (!sourceInfo || typeof sourceInfo !== "object") return undefined
  return stringValue((sourceInfo as Record<string, unknown>).source)
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function collectDiagnostics(
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

function sessionEntriesToChatMessages(entries: Array<SessionEntry>) {
  const messages: Array<ChatMessage> = []
  const toolTargets = new Map<
    string,
    { message: ChatMessage; toolName: string; input: Record<string, unknown> }
  >()

  for (const entry of entries) {
    if (entry.type !== "message") continue
    const message = entry.message

    if (isUserMessage(message)) {
      messages.push({
        id: entry.id,
        role: "user",
        createdAt: message.timestamp,
        parts: [
          { type: "text", text: textFromMessageContent(message.content) },
        ],
      })
      continue
    }

    if (isAssistantMessage(message)) {
      const parts: Array<ChatMessagePart> = []
      message.content.forEach((content, index) => {
        if (content.type === "text") {
          parts.push({ type: "text", text: content.text })
          return
        }

        if (content.type === "thinking") {
          parts.push({
            type: "tool-Thinking",
            toolCallId: `${entry.id}-thinking-${index}`,
            state: "output-available",
            input: { thought: content.thinking },
            output: content.thinking,
          })
          return
        }

        const toolName = normalizeToolName(content.name)
        const input = normalizeToolInput(toolName, content.arguments)
        const part: ChatToolPart = {
          type: `tool-${toolName}`,
          toolCallId: content.id,
          state: "input-available",
          input,
        }
        parts.push(part)
      })

      const chatMessage = toChatMessage(
        entry.id,
        "assistant",
        parts,
        message.timestamp
      )
      messages.push(chatMessage)

      for (const part of parts) {
        if (
          "toolCallId" in part &&
          typeof part.toolCallId === "string" &&
          part.type.startsWith("tool-")
        ) {
          toolTargets.set(part.toolCallId, {
            message: chatMessage,
            toolName: part.type.slice("tool-".length),
            input:
              part.input && typeof part.input === "object"
                ? (part.input as Record<string, unknown>)
                : {},
          })
        }
      }
      continue
    }

    if (isToolResultMessage(message)) {
      const target = toolTargets.get(message.toolCallId)
      const toolName = normalizeToolName(message.toolName)
      const input = target?.input ?? {}
      const part: ChatToolPart = {
        type: `tool-${toolName}`,
        toolCallId: message.toolCallId,
        state: message.isError ? "output-error" : "output-available",
        input,
        output: normalizeToolOutput(toolName, input, message, message.isError),
      }

      if (target) {
        target.message.parts = upsertToolPart(target.message.parts, part)
      } else {
        messages.push(
          toChatMessage(entry.id, "assistant", [part], message.timestamp)
        )
      }
    }
  }

  return messages
}

function isUserMessage(
  message: SessionAgentMessage
): message is Extract<SessionAgentMessage, { role: "user" }> {
  return isMessageWithRole(message, "user")
}

function isAssistantMessage(
  message: SessionAgentMessage
): message is Extract<SessionAgentMessage, { role: "assistant" }> {
  return isMessageWithRole(message, "assistant")
}

function isToolResultMessage(
  message: SessionAgentMessage
): message is Extract<SessionAgentMessage, { role: "toolResult" }> {
  return isMessageWithRole(message, "toolResult")
}

function isMessageWithRole(message: SessionAgentMessage, role: string) {
  return "role" in message && message.role === role
}

function textFromMessageContent(content: unknown) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map((part) => {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text
      }
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

function normalizeToolName(toolName: string) {
  switch (toolName.toLowerCase()) {
    case "read":
      return "Read"
    case "write":
      return "Write"
    case "edit":
      return "Edit"
    case "bash":
      return "Bash"
    case "questionnaire":
    case "question":
      return "Question"
    default:
      return toolName
  }
}

function textFromToolResult(result: unknown) {
  if (!result || typeof result !== "object") return ""
  const content = (result as { content?: unknown }).content
  if (!Array.isArray(content)) return ""
  return content
    .map((part) => {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text"
      ) {
        const text = (part as { text?: unknown }).text
        return typeof text === "string" ? text : ""
      }
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

function normalizeToolInput(toolName: string, args: unknown) {
  const input =
    args && typeof args === "object"
      ? { ...(args as Record<string, unknown>) }
      : {}

  if (toolName === "Question") {
    return normalizeQuestionInput(input)
  }

  if (typeof input.path === "string" && !input.file_path) {
    input.file_path = input.path
  }

  if (toolName === "Edit" && Array.isArray(input.edits)) {
    const edits = input.edits as Array<Record<string, unknown>>
    input.old_string = edits
      .map((edit) => (typeof edit.oldText === "string" ? edit.oldText : ""))
      .join("\n")
    input.new_string = edits
      .map((edit) => (typeof edit.newText === "string" ? edit.newText : ""))
      .join("\n")
  }

  return input
}

function normalizeToolOutput(
  toolName: string,
  input: Record<string, unknown>,
  result: unknown,
  isError = false
) {
  const text = textFromToolResult(result)
  const details =
    result && typeof result === "object"
      ? ((result as { details?: unknown }).details ?? {})
      : {}

  if (toolName === "Bash") {
    return {
      output: text,
      stdout: text,
      exitCode: isError ? 1 : 0,
      details,
    }
  }

  if (toolName === "Write") {
    return {
      content: typeof input.content === "string" ? input.content : text,
      details,
    }
  }

  if (toolName === "Edit") {
    const detailDiff =
      typeof details === "object"
        ? (details as { diff?: unknown }).diff
        : undefined
    return {
      content: typeof input.new_string === "string" ? input.new_string : text,
      old_content: typeof input.old_string === "string" ? input.old_string : "",
      diff: typeof detailDiff === "string" ? detailDiff : undefined,
      details,
    }
  }

  if (toolName === "Question") {
    return normalizeQuestionOutput(result) ?? { content: text, details }
  }

  return {
    content: text,
    details,
  }
}
