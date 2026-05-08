import { Type } from "typebox"
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent"
import type { ChatQuestionAnswer } from "./chat-protocol"

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

export function registerPlanQuestionnaireTool(pi: ExtensionAPI) {
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
}

export function resolveQuestionnaireAnswer(
  toolCallId: string | undefined,
  answer: ChatQuestionAnswer
) {
  if (!toolCallId) return false
  const pending = pendingQuestions.get(toolCallId)
  if (!pending) return false

  pendingQuestions.delete(toolCallId)
  pending.resolve(answer)
  return true
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
    let settled = false
    const cleanup = () => {
      pendingQuestions.delete(toolCallId)
      signal?.removeEventListener("abort", abort)
    }
    const resolveWithCleanup = (answer: ChatQuestionAnswer) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(answer)
    }
    const rejectWithCleanup = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const pending: PendingQuestion = {
      sessionId,
      toolCallId,
      params,
      resolve: resolveWithCleanup,
      reject: rejectWithCleanup,
    }
    pendingQuestions.set(toolCallId, pending)

    const abort = () => {
      rejectWithCleanup(new Error("Question was cancelled."))
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
  if (answer.kind === "skip") return []
  const selectedQuestion =
    findQuestionById(params.questions, answer.questionId) ??
    findQuestionByAnswer(params.questions, answer.selectedIds ?? [])

  if (answer.kind === "text") {
    const firstQuestionId =
      selectedQuestion?.id ?? firstQuestionIdFrom(params.questions)
    return [
      {
        id: firstQuestionId,
        value: answer.text ?? "",
        label: answer.text ?? "",
        wasCustom: true,
      },
    ]
  }

  const selectedIds = answer.selectedIds ?? []
  const answers = selectedIds
    .map((id) => {
      const option = findOptionForAnswer(params.questions, selectedQuestion, id)
      if (!option) return undefined
      return {
        id: option.id,
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
    const firstQuestionId =
      selectedQuestion?.id ?? firstQuestionIdFrom(params.questions)
    answers.push({
      id: firstQuestionId,
      value: answer.text.trim(),
      label: answer.text.trim(),
      wasCustom: true,
    })
  }

  return answers
}

function firstQuestionIdFrom(questions: Array<QuestionnaireQuestion>) {
  return questions.length > 0 ? questions[0].id : "custom"
}

function findQuestionById(
  questions: Array<QuestionnaireQuestion>,
  questionId: string | undefined
) {
  if (!questionId) return undefined
  return questions.find((question) => question.id === questionId)
}

function findQuestionByAnswer(
  questions: Array<QuestionnaireQuestion>,
  selectedIds: Array<string>
) {
  if (selectedIds.length === 0) return questions[0]

  return questions.find((question) =>
    selectedIds.every((selectedId) =>
      question.options.some((option) => option.value === selectedId)
    )
  )
}

function findOptionForAnswer(
  questions: Array<QuestionnaireQuestion>,
  selectedQuestion: QuestionnaireQuestion | undefined,
  selectedId: string
) {
  const inferredQuestion = findQuestionByAnswer(questions, [selectedId])
  const candidateQuestions = selectedQuestion
    ? [selectedQuestion]
    : inferredQuestion
      ? [inferredQuestion]
      : questions

  for (const currentQuestion of candidateQuestions) {
    const option = currentQuestion.options.find(
      (candidate) => candidate.value === selectedId
    )
    if (option) {
      return {
        id: currentQuestion.id,
        value: option.value,
        label: option.label,
      }
    }
  }

  return undefined
}
