import { evaluatePlanCommand } from "./command-policy"
import {
  registerPlanQuestionnaireTool,
  resolveQuestionnaireAnswer,
} from "./plan-questionnaire"
import {
  applyPlanModeSelection,
  createEmptyPlanState,
  createPlanDecisionPart,
  createPlanEvent,
  updatePlanExecutionProgress as derivePlanExecutionProgress,
  updatePlanStateFromAssistantText as derivePlanFromAssistantText,
  isPlanDecisionToolCall,
  resolvePlanDecision,
  restorePlanState as restoreStoredPlanState,
} from "./plan-state"
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai"
import type {
  AgentSessionRuntime,
  ExtensionAPI,
} from "@mariozechner/pi-coding-agent"
import type {
  ChatMode,
  ChatPlanAction,
  ChatQuestionAnswer,
} from "./chat-protocol"
import type { PlanModeState } from "./plan-state"

export {
  cleanStepText,
  extractDoneSteps,
  extractTodoItems,
  markCompletedSteps,
} from "./plan-parser"
export { createPlanDecisionPart, createPlanEvent, isPlanDecisionToolCall }
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
const NORMAL_MODE_TOOLS = [
  "read",
  "bash",
  "edit",
  "write",
  "workspace_write",
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

const planStates = new Map<string, PlanModeState>()

export function isSafeCommand(command: string) {
  return evaluatePlanCommand(command).allowed
}

export function createPlanModeExtension() {
  return (pi: ExtensionAPI) => {
    registerPlanQuestionnaireTool(pi)

    pi.on("tool_call", (event, ctx) => {
      const state = getPlanStateBySessionId(ctx.sessionManager.getSessionId())
      if (!state.enabled || event.toolName !== "bash") return

      const command =
        typeof event.input === "object" &&
        "command" in event.input &&
        typeof event.input.command === "string"
          ? event.input.command
          : ""
      const commandPolicy = evaluatePlanCommand(command)
      if (!commandPolicy.allowed) {
        return {
          block: true,
          reason: `Plan mode: ${commandPolicy.reason ?? "command blocked because it is not read-only."}\nCommand: ${command}`,
        }
      }
    })

    pi.on("context", (event, ctx) => {
      const state = getPlanStateBySessionId(ctx.sessionManager.getSessionId())
      if (state.enabled || state.executing) return

      return {
        messages: event.messages.filter((message) => {
          const custom = message as { customType?: string }
          return (
            custom.customType !== "plan-mode-context" &&
            custom.customType !== "plan-execution-context"
          )
        }),
      }
    })

    pi.on("before_agent_start", (_event, ctx) => {
      const state = getPlanStateBySessionId(ctx.sessionManager.getSessionId())
      if (state.enabled) {
        return {
          message: {
            customType: "plan-mode-context",
            content: `[PLAN MODE ACTIVE]
You are in plan mode: a read-only exploration mode for safe code analysis.

Restrictions:
- You can only use: ${PLAN_MODE_TOOLS.join(", ")}
- You CANNOT use edit or write tools.
- Bash is restricted to read-only local inspection commands. Network access, shell execution, command substitution, redirection, and file/process mutation are blocked.
- Ask clarifying questions with the questionnaire tool when intent, scope, or tradeoffs are unclear.

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
            customType: "plan-execution-context",
            content: `[EXECUTING PLAN - Full tool access enabled]

Remaining steps:
${todoList}

Execute each step in order. After completing a step, include a [DONE:n] tag in your response.`,
            display: false,
          },
        }
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
  const nextState = applyPlanModeSelection(
    getPlanState(runtime),
    mode,
    planAction
  )

  setActiveToolsForState(runtime, nextState)
  persistPlanState(runtime, nextState)
  return nextState
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
    return { state: updateExecutionProgress(runtime, assistantText).state }
  }

  if (mode === "plan") {
    const state = updatePlanFromAssistantText(runtime, assistantText)
    return {
      state,
      decisionPart: createPlanDecisionPart(assistantId, state),
    }
  }

  return undefined
}

export function answerPlanDecision(
  runtime: AgentSessionRuntime,
  answer: ChatQuestionAnswer
) {
  const result = resolvePlanDecision(getPlanState(runtime), answer)
  setActiveToolsForState(runtime, result.state)
  persistPlanState(runtime, result.state)
  return result.response
}

function getPlanStateBySessionId(sessionId: string): PlanModeState {
  return planStates.get(sessionId) ?? createEmptyPlanState()
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

function setActiveToolsForState(
  runtime: AgentSessionRuntime,
  state: PlanModeState
) {
  runtime.session.setActiveToolsByName(
    state.enabled ? PLAN_MODE_TOOLS : NORMAL_MODE_TOOLS
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
