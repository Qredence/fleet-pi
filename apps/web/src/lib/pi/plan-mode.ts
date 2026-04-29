import { Type } from "typebox"
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai"
import type {
  AgentSessionRuntime,
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent"
import type { ChatToolPart } from "@workspace/ui/components/agent-elements/chat-types"
import type {
  ChatMode,
  ChatPlanAction,
  ChatQuestionAnswer,
} from "./chat-protocol"

const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "questionnaire"]
const NORMAL_MODE_TOOLS = ["read", "bash", "edit", "write"]
export const CHAT_TOOL_ALLOWLIST = [
  ...NORMAL_MODE_TOOLS,
  "grep",
  "find",
  "ls",
  "questionnaire",
]

const PLAN_STATE_CUSTOM_TYPE = "plan-mode"
const PLAN_DECISION_TOOL_PREFIX = "plan-mode-decision"

const DESTRUCTIVE_PATTERNS = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bmv\b/i,
  /\bcp\b/i,
  /\bmkdir\b/i,
  /\btouch\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bchgrp\b/i,
  /\bln\b/i,
  /\btee\b/i,
  /\btruncate\b/i,
  /\bdd\b/i,
  /\bshred\b/i,
  /(^|[^<])>(?!>)/,
  />>/,
  /\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
  /\byarn\s+(add|remove|install|publish)/i,
  /\bpnpm\s+(add|remove|install|publish)/i,
  /\bpip\s+(install|uninstall)/i,
  /\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
  /\bbrew\s+(install|uninstall|upgrade)/i,
  /\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bkill\b/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  /\breboot\b/i,
  /\bshutdown\b/i,
  /\bsystemctl\s+(start|stop|restart|enable|disable)/i,
  /\bservice\s+\S+\s+(start|stop|restart)/i,
  /\b(vim?|nano|emacs|code|subl)\b/i,
]

const SAFE_PATTERNS = [
  /^\s*cat\b/,
  /^\s*head\b/,
  /^\s*tail\b/,
  /^\s*less\b/,
  /^\s*more\b/,
  /^\s*grep\b/,
  /^\s*find\b/,
  /^\s*ls\b/,
  /^\s*pwd\b/,
  /^\s*echo\b/,
  /^\s*printf\b/,
  /^\s*wc\b/,
  /^\s*sort\b/,
  /^\s*uniq\b/,
  /^\s*diff\b/,
  /^\s*file\b/,
  /^\s*stat\b/,
  /^\s*du\b/,
  /^\s*df\b/,
  /^\s*tree\b/,
  /^\s*which\b/,
  /^\s*whereis\b/,
  /^\s*type\b/,
  /^\s*env\b/,
  /^\s*printenv\b/,
  /^\s*uname\b/,
  /^\s*whoami\b/,
  /^\s*id\b/,
  /^\s*date\b/,
  /^\s*cal\b/,
  /^\s*uptime\b/,
  /^\s*ps\b/,
  /^\s*top\b/,
  /^\s*htop\b/,
  /^\s*free\b/,
  /^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get)/i,
  /^\s*git\s+ls-/i,
  /^\s*npm\s+(list|ls|view|info|search|outdated|audit)/i,
  /^\s*yarn\s+(list|info|why|audit)/i,
  /^\s*pnpm\s+(list|ls|why|outdated|audit)/i,
  /^\s*node\s+--version/i,
  /^\s*python\s+--version/i,
  /^\s*curl\s/i,
  /^\s*wget\s+-O\s*-/i,
  /^\s*jq\b/,
  /^\s*sed\s+-n/i,
  /^\s*awk\b/,
  /^\s*rg\b/,
  /^\s*fd\b/,
  /^\s*bat\b/,
  /^\s*eza\b/,
]

type TodoItem = {
  step: number
  text: string
  completed: boolean
}

type PlanModeState = {
  enabled: boolean
  executing: boolean
  todos: Array<TodoItem>
  pendingDecision?: boolean
}

type QuestionnaireOption = {
  value: string
  label: string
  description?: string
}

type QuestionnaireQuestion = {
  id: string
  label?: string
  prompt: string
  options: Array<QuestionnaireOption>
  allowOther?: boolean
}

type QuestionnaireParams = {
  questions: Array<QuestionnaireQuestion>
}

type PendingQuestion = {
  sessionId: string
  toolCallId: string
  params: QuestionnaireParams
  resolve: (answer: ChatQuestionAnswer) => void
  reject: (error: Error) => void
}

const planStates = new Map<string, PlanModeState>()
const pendingQuestions = new Map<string, PendingQuestion>()

const QuestionnaireOptionSchema = Type.Object({
  value: Type.String({ description: "The value returned when selected" }),
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(
    Type.String({ description: "Optional description" })
  ),
})

const QuestionnaireQuestionSchema = Type.Object({
  id: Type.String({ description: "Unique identifier for this question" }),
  label: Type.Optional(Type.String({ description: "Short label" })),
  prompt: Type.String({ description: "The question text to display" }),
  options: Type.Array(QuestionnaireOptionSchema),
  allowOther: Type.Optional(
    Type.Boolean({ description: "Allow custom answer" })
  ),
})

const QuestionnaireParamsSchema = Type.Object({
  questions: Type.Array(QuestionnaireQuestionSchema),
})

export function isSafeCommand(command: string) {
  const isDestructive = DESTRUCTIVE_PATTERNS.some((pattern) =>
    pattern.test(command)
  )
  const isSafe = SAFE_PATTERNS.some((pattern) => pattern.test(command))
  return !isDestructive && isSafe
}

export function cleanStepText(text: string) {
  let cleaned = text
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(
      /^(Use|Run|Execute|Create|Write|Read|Check|Verify|Update|Modify|Add|Remove|Delete|Install)\s+(the\s+)?/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim()

  if (cleaned.length > 0) {
    cleaned = `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`
  }
  return cleaned.length > 50 ? `${cleaned.slice(0, 47)}...` : cleaned
}

export function extractTodoItems(message: string) {
  const items: Array<TodoItem> = []
  const headerMatch = message.match(/\*{0,2}Plan:\*{0,2}\s*\n/i)
  if (!headerMatch) return items

  const planSection = message.slice(
    message.indexOf(headerMatch[0]) + headerMatch[0].length
  )
  const numberedPattern = /^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/gm

  for (const match of planSection.matchAll(numberedPattern)) {
    const text = match[2]
      .trim()
      .replace(/\*{1,2}$/, "")
      .trim()
    if (
      text.length > 5 &&
      !text.startsWith("`") &&
      !text.startsWith("/") &&
      !text.startsWith("-")
    ) {
      const cleaned = cleanStepText(text)
      if (cleaned.length > 3) {
        items.push({ step: items.length + 1, text: cleaned, completed: false })
      }
    }
  }
  return items
}

export function extractDoneSteps(message: string) {
  const steps: Array<number> = []
  for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
    const step = Number(match[1])
    if (Number.isFinite(step)) steps.push(step)
  }
  return steps
}

export function markCompletedSteps(text: string, items: Array<TodoItem>) {
  let changed = 0
  for (const step of extractDoneSteps(text)) {
    const item = items.find((todo) => todo.step === step)
    if (item && !item.completed) {
      item.completed = true
      changed += 1
    }
  }
  return changed
}

export function createPlanModeExtension() {
  return (pi: ExtensionAPI) => {
    pi.registerTool({
      name: "questionnaire",
      label: "Questionnaire",
      description:
        "Ask the user one or more questions. Use for clarifying requirements, preferences, or decisions before continuing.",
      parameters: QuestionnaireParamsSchema,
      executionMode: "sequential",
      async execute(toolCallId, params, signal, _onUpdate, ctx) {
        return executeQuestionnaireTool(toolCallId, params, signal, ctx)
      },
    })

    pi.on("tool_call", (event, ctx) => {
      const state = getPlanStateBySessionId(ctx.sessionManager.getSessionId())
      if (!state.enabled || event.toolName !== "bash") return

      const command =
        typeof event.input === "object" &&
        "command" in event.input &&
        typeof event.input.command === "string"
          ? event.input.command
          : ""
      if (!isSafeCommand(command)) {
        return {
          block: true,
          reason: `Plan mode: command blocked because it is not read-only.\nCommand: ${command}`,
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
- Bash is restricted to an allowlist of read-only commands.
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

      if (markCompletedSteps(getTextContent(event.message), state.todos) > 0) {
        planStates.set(ctx.sessionManager.getSessionId(), state)
        pi.appendEntry(PLAN_STATE_CUSTOM_TYPE, state)
      }
    })
  }
}

export function applyPlanMode(
  runtime: AgentSessionRuntime,
  mode?: ChatMode,
  planAction?: ChatPlanAction
) {
  const state = getPlanState(runtime)

  if (planAction === "execute") {
    state.enabled = false
    state.executing = state.todos.some((todo) => !todo.completed)
    state.pendingDecision = false
  } else if (planAction === "refine" || mode === "plan") {
    state.enabled = true
    state.executing = false
  } else {
    state.enabled = false
    state.executing = false
    state.pendingDecision = false
  }

  setActiveToolsForState(runtime, state)
  persistPlanState(runtime, state)

  return state
}

export function getPlanState(runtime: AgentSessionRuntime): PlanModeState {
  const sessionId = runtime.session.sessionId
  const existing = planStates.get(sessionId)
  if (existing) return existing

  const restored = restorePlanState(runtime)
  planStates.set(sessionId, restored)
  return restored
}

export function updatePlanFromAssistantText(
  runtime: AgentSessionRuntime,
  text: string
) {
  const state = getPlanState(runtime)
  if (!state.enabled) return state

  const todos = extractTodoItems(text)
  if (todos.length > 0) {
    state.todos = todos
    state.executing = false
    state.pendingDecision = true
    persistPlanState(runtime, state)
  }
  return state
}

export function updateExecutionProgress(
  runtime: AgentSessionRuntime,
  assistantText: string
) {
  const state = getPlanState(runtime)
  if (!state.executing) return { state, changed: false }

  const changed = markCompletedSteps(assistantText, state.todos) > 0
  if (changed) persistPlanState(runtime, state)
  if (state.todos.length > 0 && state.todos.every((todo) => todo.completed)) {
    state.executing = false
    persistPlanState(runtime, state)
  }
  return { state, changed }
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

export function isPlanDecisionToolCall(toolCallId?: string) {
  return Boolean(toolCallId?.startsWith(PLAN_DECISION_TOOL_PREFIX))
}

export function answerPlanDecision(
  runtime: AgentSessionRuntime,
  answer: ChatQuestionAnswer
) {
  const state = getPlanState(runtime)
  const selected = answer.selectedIds?.[0]
  state.pendingDecision = false

  if (selected === "execute") {
    state.enabled = false
    state.executing = state.todos.some((todo) => !todo.completed)
    setActiveToolsForState(runtime, state)
    persistPlanState(runtime, state)
    const first = state.todos.find((todo) => !todo.completed)
    return {
      ok: true,
      message: first
        ? `Execute the plan. Start with: ${first.text}`
        : "Execute the plan you just created.",
      mode: "agent" as const,
      planAction: "execute" as const,
    }
  }

  if (selected === "refine" || answer.text?.trim()) {
    state.enabled = true
    state.executing = false
    setActiveToolsForState(runtime, state)
    persistPlanState(runtime, state)
    return {
      ok: true,
      message: answer.text?.trim() || "Refine the plan.",
      mode: "plan" as const,
      planAction: "refine" as const,
    }
  }

  state.enabled = true
  state.executing = false
  setActiveToolsForState(runtime, state)
  persistPlanState(runtime, state)
  return { ok: true }
}

export function resolveQuestionnaireAnswer(
  toolCallId: string | undefined,
  answer: ChatQuestionAnswer
) {
  if (!toolCallId) return false
  const pending = pendingQuestions.get(toolCallId)
  if (!pending) return false

  pending.resolve(answer)
  pendingQuestions.delete(toolCallId)
  return true
}

export function normalizeQuestionInput(input: Record<string, unknown>) {
  const rawQuestions = Array.isArray(input.questions) ? input.questions : []
  const questions = rawQuestions
    .map((raw): Record<string, unknown> | undefined => {
      if (!raw || typeof raw !== "object") return undefined
      const question = raw as Record<string, unknown>
      const rawOptions = Array.isArray(question.options) ? question.options : []
      const options = rawOptions
        .map((rawOption): Record<string, string> | undefined => {
          if (!rawOption || typeof rawOption !== "object") return undefined
          const option = rawOption as Record<string, unknown>
          const id =
            typeof option.value === "string"
              ? option.value
              : typeof option.id === "string"
                ? option.id
                : undefined
          const label =
            typeof option.label === "string"
              ? option.label
              : typeof option.value === "string"
                ? option.value
                : undefined
          if (!id || !label) return undefined
          return {
            id,
            label,
            ...(typeof option.description === "string"
              ? { description: option.description }
              : {}),
          }
        })
        .filter((option): option is Record<string, string> => Boolean(option))

      const title =
        typeof question.prompt === "string"
          ? question.prompt
          : typeof question.title === "string"
            ? question.title
            : undefined
      if (!title) return undefined

      return {
        kind: options.length > 0 ? "single" : "text",
        title,
        options,
        allowCustom: question.allowOther !== false,
        customPlaceholder: "Type something else",
      }
    })
    .filter((question): question is Record<string, unknown> =>
      Boolean(question)
    )

  return {
    ...input,
    questions,
    totalQuestions: questions.length,
    submitLabel: "Send",
    allowSkip: true,
  }
}

export function normalizeQuestionOutput(result: unknown) {
  if (!result || typeof result !== "object") return undefined
  const details = (result as { details?: unknown }).details
  if (!details || typeof details !== "object") return undefined
  const answers = (details as { answers?: unknown }).answers
  if (!Array.isArray(answers)) return undefined

  return {
    answers,
    answer: answers[0],
  }
}

function getPlanStateBySessionId(sessionId: string): PlanModeState {
  return (
    planStates.get(sessionId) ?? {
      enabled: false,
      executing: false,
      todos: [],
      pendingDecision: false,
    }
  )
}

function restorePlanState(runtime: AgentSessionRuntime): PlanModeState {
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

  if (entry?.data && typeof entry.data === "object") {
    const data = entry.data as Partial<PlanModeState>
    return {
      enabled: Boolean(data.enabled),
      executing: Boolean(data.executing),
      todos: Array.isArray(data.todos) ? data.todos : [],
      pendingDecision: Boolean(data.pendingDecision),
    }
  }

  return {
    enabled: false,
    executing: false,
    todos: [],
    pendingDecision: false,
  }
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

async function executeQuestionnaireTool(
  toolCallId: string,
  params: QuestionnaireParams,
  signal: AbortSignal | undefined,
  ctx: ExtensionContext
) {
  if (params.questions.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No questions provided." }],
      details: { questions: [], answers: [], cancelled: true },
      isError: true,
    }
  }

  const answer = await waitForQuestionAnswer(
    ctx.sessionManager.getSessionId(),
    toolCallId,
    params,
    signal
  )
  const answers = questionnaireAnswers(params, answer)
  const cancelled = answer.kind === "skip"

  return {
    content: [
      {
        type: "text" as const,
        text: cancelled
          ? "User skipped the question."
          : `User answered: ${answers.map((item) => item.label).join(", ")}`,
      },
    ],
    details: {
      questions: params.questions,
      answers,
      cancelled,
    },
  }
}

function waitForQuestionAnswer(
  sessionId: string,
  toolCallId: string,
  params: QuestionnaireParams,
  signal: AbortSignal | undefined
) {
  return new Promise<ChatQuestionAnswer>((resolve, reject) => {
    const pending: PendingQuestion = {
      sessionId,
      toolCallId,
      params,
      resolve,
      reject,
    }
    pendingQuestions.set(toolCallId, pending)

    const abort = () => {
      pendingQuestions.delete(toolCallId)
      reject(new Error("Question was cancelled."))
    }

    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener("abort", abort, { once: true })
  })
}

function questionnaireAnswers(
  params: QuestionnaireParams,
  answer: ChatQuestionAnswer
) {
  const question = params.questions[0]
  if (answer.kind === "skip") return []

  if (answer.kind === "text") {
    return [
      {
        id: question.id,
        value: answer.text ?? "",
        label: answer.text ?? "",
        wasCustom: true,
      },
    ]
  }

  const selectedIds = answer.selectedIds ?? []
  const answers = selectedIds
    .map((id) => {
      const option = question.options.find((item) => item.value === id)
      if (!option) return undefined
      return {
        id: question.id,
        value: option.value,
        label: option.label,
        wasCustom: false,
      }
    })
    .filter(
      (
        item
      ): item is {
        id: string
        value: string
        label: string
        wasCustom: boolean
      } => Boolean(item)
    )

  if (answer.text?.trim()) {
    answers.push({
      id: question.id,
      value: answer.text.trim(),
      label: answer.text.trim(),
      wasCustom: true,
    })
  }

  return answers
}
