import { keepLastCustomType } from "./context-filter"
import { evaluatePlanCommand } from "./command-policy"
import {
  AGENT_MODE_CONTEXT_CUSTOM_TYPE,
  HARNESS_MODE_CONTEXT_CUSTOM_TYPE,
  HARNESS_MODE_TOOLS,
  MODE_CONTEXT_CUSTOM_TYPES,
  NORMAL_MODE_TOOLS,
  PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE,
  PLAN_MODE_CONTEXT_CUSTOM_TYPE,
  PLAN_MODE_TOOLS,
  buildModeContextMessage,
} from "./mode-context-prompts"
import {
  registerPlanQuestionnaireTool,
  resolveQuestionnaireAnswer,
} from "./plan-questionnaire"
import {
  applyPlanModeSelection,
  bindPendingPlanDecisionToolCallId,
  createEmptyPlanState,
  createPlanEvent,
  createPlanToolPart,
  updatePlanExecutionProgress as derivePlanExecutionProgress,
  updatePlanStateFromAssistantText as derivePlanFromAssistantText,
  isPlanDecisionToolCall,
  resolvePlanDecision,
  restorePlanState as restoreStoredPlanState,
} from "./plan-state"
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai"
import type {
  AgentSessionRuntime,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent"
import type {
  ChatMode,
  ChatPlanAction,
  ChatQuestionAnswer,
} from "@workspace/pi-protocol/chat-protocol"
import type { AgentMessage } from "@earendil-works/pi-agent-core"
import type { PlanModeState } from "./plan-state"

export {
  cleanStepText,
  extractDoneSteps,
  extractTodoItems,
  markCompletedSteps,
} from "./plan-parser"
export { createPlanEvent, createPlanToolPart, isPlanDecisionToolCall }
export { resolveQuestionnaireAnswer }

export const CHAT_TOOL_ALLOWLIST = [
  ...NORMAL_MODE_TOOLS,
  "grep",
  "find",
  "ls",
  "questionnaire",
]

const PLAN_STATE_CUSTOM_TYPE = "plan-mode"

const planStates = new Map<string, PlanModeState>()

class BoundedSessionMap<V> extends Map<string, V> {
  constructor(private readonly maxEntries: number) {
    super()
  }

  override set(key: string, value: V) {
    if (!this.has(key) && this.size >= this.maxEntries) {
      const oldestKey = this.keys().next().value
      if (oldestKey !== undefined) {
        this.delete(oldestKey)
      }
    }

    return super.set(key, value)
  }
}

const chatModes = new BoundedSessionMap<ChatMode>(1000)

export function isSafeCommand(command: string) {
  return evaluatePlanCommand(command).allowed
}

export function createPlanModeExtension() {
  return (pi: ExtensionAPI) => {
    registerPlanQuestionnaireTool(pi)

    pi.on("tool_call", (event, ctx) => {
      const state = getPlanStateBySessionId(ctx.sessionManager.getSessionId())
      const activeMode = getChatModeBySessionId(
        ctx.sessionManager.getSessionId()
      )
      if (!state.enabled && activeMode !== "harness") return

      if (activeMode === "harness" && isGeneralMutationTool(event.toolName)) {
        return {
          block: true,
          reason:
            "Harness mode: use workspace_write or resource_install for agent-workspace architecture changes instead of general repo mutation tools.",
        }
      }

      if (event.toolName !== "bash") return

      const command =
        typeof event.input === "object" &&
        "command" in event.input &&
        typeof event.input.command === "string"
          ? event.input.command
          : ""
      const commandPolicy = evaluatePlanCommand(command)
      if (!commandPolicy.allowed) {
        const label = activeMode === "harness" ? "Harness mode" : "Plan mode"
        return {
          block: true,
          reason: `${label}: ${commandPolicy.reason ?? "command blocked because it is not read-only."}\nCommand: ${command}`,
        }
      }
    })

    pi.on("context", (event, ctx) => {
      const state = getPlanStateBySessionId(ctx.sessionManager.getSessionId())
      const activeMode = getChatModeBySessionId(
        ctx.sessionManager.getSessionId()
      )
      const activeContextType = getActiveModeContextType(state, activeMode)
      return filterModeContextMessages(event.messages, activeContextType)
    })

    pi.on("before_agent_start", (_event, ctx) => {
      const state = getPlanStateBySessionId(ctx.sessionManager.getSessionId())
      const activeMode = getChatModeBySessionId(
        ctx.sessionManager.getSessionId()
      )
      const message = buildModeContextMessage(state, activeMode)
      if (!message) return

      return {
        message: {
          customType: message.customType,
          content: message.content,
          display: false,
        },
      }
    })

    pi.on("turn_end", (event, ctx) => {
      const state = getPlanStateBySessionId(ctx.sessionManager.getSessionId())
      if (!state.executing || state.todos.length === 0) return
      if (!isAssistantMessage(event.message)) return

      const result = derivePlanExecutionProgress(
        state,
        getTextContent(event.message)
      )
      if (result.changed) {
        planStates.set(ctx.sessionManager.getSessionId(), result.state)
        pi.appendEntry(PLAN_STATE_CUSTOM_TYPE, result.state)
      }
    })
  }
}

export function applyPlanMode(
  runtime: AgentSessionRuntime,
  mode?: ChatMode,
  planAction?: ChatPlanAction
) {
  const nextMode = mode ?? getChatMode(runtime)
  const nextState = applyPlanModeSelection(
    getPlanState(runtime),
    nextMode,
    planAction
  )

  chatModes.set(runtime.session.sessionId, nextMode)
  setActiveToolsForState(runtime, nextState, nextMode)
  persistPlanState(runtime, nextState)
  return nextState
}

export function getChatMode(runtime: AgentSessionRuntime): ChatMode {
  return getChatModeBySessionId(runtime.session.sessionId)
}

export function clearPlanModeSession(sessionId: string) {
  planStates.delete(sessionId)
  chatModes.delete(sessionId)
}

export function getPlanState(runtime: AgentSessionRuntime): PlanModeState {
  const sessionId = runtime.session.sessionId
  const existing = planStates.get(sessionId)
  if (existing) return existing

  const restored = restorePersistedPlanState(runtime)
  planStates.set(sessionId, restored)
  return restored
}

export function updatePlanFromAssistantText(
  runtime: AgentSessionRuntime,
  text: string
) {
  const result = derivePlanFromAssistantText(getPlanState(runtime), text)
  if (result.changed) {
    persistPlanState(runtime, result.state)
  }
  return result.state
}

export function updateExecutionProgress(
  runtime: AgentSessionRuntime,
  assistantText: string
) {
  const result = derivePlanExecutionProgress(
    getPlanState(runtime),
    assistantText
  )
  if (result.changed) {
    persistPlanState(runtime, result.state)
  }
  return result
}

export function finalizePlanTurn({
  runtime,
  assistantId,
  assistantText,
  mode,
  planAction,
}: {
  runtime: AgentSessionRuntime
  assistantId: string
  assistantText: string
  mode?: ChatMode
  planAction?: ChatPlanAction
}) {
  if (planAction === "execute") {
    const state = updateExecutionProgress(runtime, assistantText).state
    return {
      state,
      planPart: createPlanToolPart(assistantId, state),
    }
  }

  if (mode === "plan") {
    const state = bindPlanDecisionToolCall(
      runtime,
      updatePlanFromAssistantText(runtime, assistantText),
      assistantId
    )
    return {
      state,
      planPart: createPlanToolPart(assistantId, state),
    }
  }

  return undefined
}

export function answerPlanDecision(
  runtime: AgentSessionRuntime,
  answer: ChatQuestionAnswer
) {
  const result = resolvePlanDecision(getPlanState(runtime), answer)
  if (result.response.mode) {
    chatModes.set(runtime.session.sessionId, result.response.mode)
  }
  setActiveToolsForState(runtime, result.state, getChatMode(runtime))
  persistPlanState(runtime, result.state)
  return result.response
}

function getPlanStateBySessionId(sessionId: string): PlanModeState {
  return planStates.get(sessionId) ?? createEmptyPlanState()
}

function getChatModeBySessionId(sessionId: string): ChatMode {
  return chatModes.get(sessionId) ?? "agent"
}

function restorePersistedPlanState(
  runtime: AgentSessionRuntime
): PlanModeState {
  const entry = runtime.session.sessionManager
    .getEntries()
    .filter((item) => {
      return (
        item.type === "custom" &&
        "customType" in item &&
        item.customType === PLAN_STATE_CUSTOM_TYPE
      )
    })
    .pop() as { data?: unknown } | undefined

  return restoreStoredPlanState(entry?.data)
}

function persistPlanState(runtime: AgentSessionRuntime, state: PlanModeState) {
  planStates.set(runtime.session.sessionId, state)
  runtime.session.sessionManager.appendCustomEntry(
    PLAN_STATE_CUSTOM_TYPE,
    state
  )
}

function bindPlanDecisionToolCall(
  runtime: AgentSessionRuntime,
  state: PlanModeState,
  assistantId: string
) {
  const nextState = bindPendingPlanDecisionToolCallId(state, assistantId)
  if (nextState !== state) {
    persistPlanState(runtime, nextState)
  }
  return nextState
}

function setActiveToolsForState(
  runtime: AgentSessionRuntime,
  state: PlanModeState,
  mode: ChatMode
) {
  runtime.session.setActiveToolsByName(
    state.enabled
      ? PLAN_MODE_TOOLS
      : mode === "harness"
        ? HARNESS_MODE_TOOLS
        : NORMAL_MODE_TOOLS
  )
}

function isGeneralMutationTool(toolName: string) {
  return toolName === "edit" || toolName === "write"
}

function getActiveModeContextType(state: PlanModeState, mode: ChatMode) {
  if (state.enabled) return PLAN_MODE_CONTEXT_CUSTOM_TYPE
  if (state.executing) return PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE
  if (mode === "harness") return HARNESS_MODE_CONTEXT_CUSTOM_TYPE
  return AGENT_MODE_CONTEXT_CUSTOM_TYPE
}

function filterModeContextMessages(
  messages: Array<AgentMessage>,
  activeContextType: string
) {
  return keepLastCustomType(
    messages,
    activeContextType,
    MODE_CONTEXT_CUSTOM_TYPES
  )
}

function isAssistantMessage(message: unknown): message is AssistantMessage {
  return (
    message !== null &&
    typeof message === "object" &&
    "role" in message &&
    message.role === "assistant" &&
    "content" in message &&
    Array.isArray(message.content)
  )
}

function getTextContent(message: AssistantMessage) {
  return message.content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n")
}
