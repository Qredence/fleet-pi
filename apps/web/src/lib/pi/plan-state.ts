import { extractTodoItems, markCompletedSteps } from "./plan-parser"
import type { ChatToolPart } from "@workspace/ui/components/agent-elements/chat-types"
import type {
  ChatMode,
  ChatPlanAction,
  ChatQuestionAnswer,
  ChatQuestionAnswerResponse,
} from "./chat-protocol"
import type { TodoItem } from "./plan-parser"

export const PLAN_DECISION_TOOL_PREFIX = "plan-mode-decision"

export type PlanModeState = {
  enabled: boolean
  executing: boolean
  todos: Array<TodoItem>
  pendingDecision?: boolean
}

export function createEmptyPlanState(): PlanModeState {
  return {
    enabled: false,
    executing: false,
    todos: [],
    pendingDecision: false,
  }
}

export function restorePlanState(data: unknown): PlanModeState {
  if (!data || typeof data !== "object") return createEmptyPlanState()

  const candidate = data as Partial<PlanModeState>
  return {
    enabled: Boolean(candidate.enabled),
    executing: Boolean(candidate.executing),
    todos: normalizeTodos(candidate.todos),
    pendingDecision: Boolean(candidate.pendingDecision),
  }
}

export function applyPlanModeSelection(
  state: PlanModeState,
  mode?: ChatMode,
  planAction?: ChatPlanAction
) {
  const nextState = cloneState(state)

  if (planAction === "execute") {
    nextState.enabled = false
    nextState.executing = nextState.todos.some((todo) => !todo.completed)
    nextState.pendingDecision = false
    return nextState
  }

  if (planAction === "refine" || mode === "plan") {
    nextState.enabled = true
    nextState.executing = false
    return nextState
  }

  nextState.enabled = false
  nextState.executing = false
  nextState.pendingDecision = false
  return nextState
}

export function updatePlanStateFromAssistantText(
  state: PlanModeState,
  text: string
) {
  if (!state.enabled) return { state, changed: false }

  const todos = extractTodoItems(text)
  if (todos.length === 0) return { state, changed: false }

  return {
    state: {
      ...cloneState(state),
      todos,
      executing: false,
      pendingDecision: true,
    },
    changed: true,
  }
}

export function updatePlanExecutionProgress(
  state: PlanModeState,
  assistantText: string
) {
  if (!state.executing) return { state, changed: false }

  const nextState = cloneState(state)
  const changed = markCompletedSteps(assistantText, nextState.todos) > 0
  if (
    nextState.todos.length > 0 &&
    nextState.todos.every((todo) => todo.completed)
  ) {
    nextState.executing = false
    return { state: nextState, changed: true }
  }

  return { state: nextState, changed }
}

export function createPlanEvent(state: PlanModeState) {
  const completed = state.todos.filter((todo) => todo.completed).length
  const total = state.todos.length
  const mode: ChatMode = state.enabled ? "plan" : "agent"
  const message = state.executing
    ? total > 0
      ? `Plan progress ${completed}/${total}`
      : "Executing plan"
    : state.enabled
      ? "Plan mode"
      : undefined

  return {
    type: "plan" as const,
    mode,
    executing: state.executing,
    completed,
    total,
    message,
  }
}

export function createPlanDecisionPart(
  assistantId: string,
  state: PlanModeState
): ChatToolPart | undefined {
  if (!state.pendingDecision) return undefined

  return {
    type: "tool-Question",
    toolCallId: `${PLAN_DECISION_TOOL_PREFIX}-${assistantId}`,
    state: "input-available",
    input: {
      questions: [
        {
          kind: "single",
          title: "Plan mode - what next?",
          options: [
            {
              id: "execute",
              label: "Execute the plan",
              description: "Switch to agent mode and run the planned steps.",
            },
            {
              id: "stay",
              label: "Stay in plan mode",
              description: "Keep the plan without starting implementation.",
            },
            {
              id: "refine",
              label: "Refine the plan",
              description: "Send more guidance and update the plan.",
            },
          ],
          allowCustom: true,
          customLabel: "Refine with instructions",
          customPlaceholder: "Describe what to change in the plan",
        },
      ],
      submitLabel: "Continue",
      allowSkip: false,
    },
  }
}

export function isPlanDecisionToolCall(toolCallId?: string) {
  return Boolean(toolCallId?.startsWith(PLAN_DECISION_TOOL_PREFIX))
}

export function resolvePlanDecision(
  state: PlanModeState,
  answer: ChatQuestionAnswer
): {
  state: PlanModeState
  response: ChatQuestionAnswerResponse
} {
  const nextState = cloneState(state)
  const selected = answer.selectedIds?.[0]
  nextState.pendingDecision = false

  if (selected === "execute") {
    nextState.enabled = false
    nextState.executing = nextState.todos.some((todo) => !todo.completed)
    const first = nextState.todos.find((todo) => !todo.completed)
    return {
      state: nextState,
      response: {
        ok: true,
        message: first
          ? `Execute the plan. Start with: ${first.text}`
          : "Execute the plan you just created.",
        mode: "agent",
        planAction: "execute",
      },
    }
  }

  if (selected === "refine" || (!selected && answer.text?.trim())) {
    nextState.enabled = true
    nextState.executing = false
    return {
      state: nextState,
      response: {
        ok: true,
        message: answer.text?.trim() || "Refine the plan.",
        mode: "plan",
        planAction: "refine",
      },
    }
  }

  nextState.enabled = true
  nextState.executing = false
  return {
    state: nextState,
    response: { ok: true },
  }
}

function cloneState(state: PlanModeState): PlanModeState {
  return {
    enabled: state.enabled,
    executing: state.executing,
    todos: state.todos.map((todo) => ({ ...todo })),
    pendingDecision: Boolean(state.pendingDecision),
  }
}

function normalizeTodos(todos: unknown): Array<TodoItem> {
  if (!Array.isArray(todos)) return []

  return todos
    .map((todo, index) => {
      if (!todo || typeof todo !== "object") return undefined
      const candidate = todo as Partial<TodoItem>
      return {
        step:
          typeof candidate.step === "number" && Number.isFinite(candidate.step)
            ? candidate.step
            : index + 1,
        text: typeof candidate.text === "string" ? candidate.text : "",
        completed: Boolean(candidate.completed),
      }
    })
    .filter((todo): todo is TodoItem => Boolean(todo?.text))
}
