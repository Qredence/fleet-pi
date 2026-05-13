import { evaluatePlanCommand } from "./command-policy"
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
} from "./chat-protocol"
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

const PROJECT_RESOURCE_TOOLS = ["project_inventory", "workspace_index"]
const AUTOCONTEXT_STATUS_TOOLS = [
  "autocontext_status",
  "autocontext_scenarios",
  "autocontext_runtime_snapshot",
]
const AUTOCONTEXT_AGENT_TOOLS = [
  "autocontext_judge",
  "autocontext_improve",
  ...AUTOCONTEXT_STATUS_TOOLS,
  "autocontext_queue",
]
const AUTORESEARCH_AGENT_TOOLS = [
  "init_experiment",
  "run_experiment",
  "log_experiment",
]
const SUBAGENT_AGENT_TOOLS = ["subagent"]
const PLAN_MODE_TOOLS = [
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "questionnaire",
  ...PROJECT_RESOURCE_TOOLS,
  ...AUTOCONTEXT_STATUS_TOOLS,
]
const HARNESS_MODE_TOOLS = [
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "workspace_write",
  "resource_install",
  "questionnaire",
  "web_fetch",
  ...PROJECT_RESOURCE_TOOLS,
  ...AUTOCONTEXT_STATUS_TOOLS,
]
const NORMAL_MODE_TOOLS = [
  "read",
  "bash",
  "edit",
  "write",
  "workspace_write",
  "resource_install",
  "questionnaire",
  "web_fetch",
  ...PROJECT_RESOURCE_TOOLS,
  ...AUTOCONTEXT_AGENT_TOOLS,
  ...AUTORESEARCH_AGENT_TOOLS,
  ...SUBAGENT_AGENT_TOOLS,
]
export const CHAT_TOOL_ALLOWLIST = [
  ...NORMAL_MODE_TOOLS,
  "grep",
  "find",
  "ls",
  "questionnaire",
]

const PLAN_STATE_CUSTOM_TYPE = "plan-mode"
const AGENT_MODE_CONTEXT_CUSTOM_TYPE = "agent-mode-context"
const PLAN_MODE_CONTEXT_CUSTOM_TYPE = "plan-mode-context"
const PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE = "plan-execution-context"
const HARNESS_MODE_CONTEXT_CUSTOM_TYPE = "harness-mode-context"
const MODE_CONTEXT_CUSTOM_TYPES = new Set([
  AGENT_MODE_CONTEXT_CUSTOM_TYPE,
  PLAN_MODE_CONTEXT_CUSTOM_TYPE,
  PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE,
  HARNESS_MODE_CONTEXT_CUSTOM_TYPE,
])

const planStates = new Map<string, PlanModeState>()
const chatModes = new Map<string, ChatMode>()

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
      if (state.enabled) {
        return {
          message: {
            customType: PLAN_MODE_CONTEXT_CUSTOM_TYPE,
            content: `[PLAN MODE ACTIVE]
You are in plan mode: a read-only exploration mode for safe code analysis.

Restrictions:
- You can only use: ${PLAN_MODE_TOOLS.join(", ")}
- You CANNOT use edit or write tools.
- Bash is restricted to read-only local inspection commands. Network access, shell execution, command substitution, redirection, and file/process mutation are blocked.
- Ask clarifying questions with the questionnaire tool when intent, scope, or tradeoffs are unclear.
- Treat agent-workspace/ as Fleet Pi's own environment. Do not redesign or manage its architecture from Plan mode; switch to Harness mode for that.

Create a concise numbered plan under a "Plan:" header:

Plan:
1. First step description
2. Second step description

Do not make code changes in plan mode.`,
            display: false,
          },
        }
      }

      if (state.executing && state.todos.length > 0) {
        const remaining = state.todos.filter((todo) => !todo.completed)
        const todoList = remaining
          .map((todo) => `${todo.step}. ${todo.text}`)
          .join("\n")
        return {
          message: {
            customType: PLAN_EXECUTION_CONTEXT_CUSTOM_TYPE,
            content: `[EXECUTING PLAN - Full tool access enabled]

Remaining steps:
${todoList}

Execute each step in order. After completing a step, include a [DONE:n] tag in your response.`,
            display: false,
          },
        }
      }

      if (activeMode === "harness") {
        return {
          message: {
            customType: HARNESS_MODE_CONTEXT_CUSTOM_TYPE,
            content: `[HARNESS MODE ACTIVE]
You are managing Fleet Pi's agent-workspace/ architecture and durable adaptive layer.

Pi architecture alignment:
- Keep Fleet Pi's core small and prefer Pi-native extension points.
- Model architecture changes around Pi's documented TypeScript extensions, skills, prompt templates, themes, packages, project settings, sessions, and SDK/runtime APIs.
- Prefer @earendil-works/pi-coding-agent as the primary facade. Use @earendil-works/pi-ai and @earendil-works/pi-agent-core concepts when deeper model, message, agent state, or runtime architecture work requires them.

Restrictions:
- You can only use: ${HARNESS_MODE_TOOLS.join(", ")}
- Read the repo for context, but do not mutate application code with edit or write.
- Use workspace_index and project_inventory for orientation.
- Use workspace_write for durable agent-workspace/ updates and include rationale for rationale-required/protected areas.
- Use resource_install for Pi skills, prompts, extensions, themes, and package bundles.
- Bash is restricted to read-only local inspection commands.
- Ask clarifying questions with the questionnaire tool when architecture ownership, Pi compatibility, or safety tradeoffs are unclear.`,
            display: false,
          },
        }
      }

      return {
        message: {
          customType: AGENT_MODE_CONTEXT_CUSTOM_TYPE,
          content: `[AGENT MODE ACTIVE]
Follow the operating constraints from agent-workspace/AGENTS.md (injected in workspace context).
Use agent-workspace/ as context when it helps the coding task. Do not redesign or manage the agent-workspace/ architecture from Agent mode unless the user explicitly asks to switch to Harness mode.`,
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
  const lastActiveIndex = messages.reduce(
    (lastIndex, message, index) =>
      getCustomType(message) === activeContextType ? index : lastIndex,
    -1
  )
  if (lastActiveIndex === -1) return undefined

  const filtered = messages.filter((message, index) => {
    const customType = getCustomType(message)
    if (!customType || !MODE_CONTEXT_CUSTOM_TYPES.has(customType)) return true
    return customType === activeContextType && index === lastActiveIndex
  })

  if (filtered.length === messages.length) return undefined
  return { messages: filtered }
}

function getCustomType(message: unknown) {
  return typeof message === "object" &&
    message !== null &&
    "customType" in message &&
    typeof message.customType === "string"
    ? message.customType
    : undefined
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
