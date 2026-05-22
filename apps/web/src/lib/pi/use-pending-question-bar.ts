import { useMemo } from "react"
import type {
  QuestionAnswer,
  QuestionConfig,
  QuestionOption,
} from "@workspace/ui/components/agent-elements/question/question-prompt"

type ToolQuestionPart = {
  type: "tool-Question"
  toolCallId?: string
  state?: string
  input?: {
    questions?: Array<{
      id?: string
      prompt?: string
      title?: string
      options?: Array<{
        value?: string
        label?: string
        description?: string
      }>
      allowOther?: boolean
      allowCustom?: boolean
      kind?: "single" | "multi" | "text"
    }>
  }
  output?: {
    answer?: unknown
    answers?: Array<unknown>
    content?: string
    details?: unknown
  }
}

type ChatMessageLike = {
  role: string
  parts?: Array<{ type?: string; [key: string]: unknown }>
}

type PendingQuestionBarResult = {
  id: string
  questions: Array<QuestionConfig>
  submitLabel: string
  allowSkip: boolean
  onSubmit: (answer: QuestionAnswer) => void
}

/**
 * Scans the message list for the last unanswered `tool-Question` part and
 * returns a shaped `questionBar` prop for the InputBar, or `undefined` if
 * no question is pending.
 */
export function usePendingQuestionBar({
  messages,
  answerQuestion,
}: {
  messages: Array<ChatMessageLike>
  answerQuestion: (payload: {
    toolCallId?: string
    answer: QuestionAnswer
  }) => void
}): PendingQuestionBarResult | undefined {
  return useMemo(() => {
    const pending = findPendingQuestionPart(messages)
    if (!pending) return undefined

    const { part } = pending
    const rawQuestions = part.input?.questions ?? []
    if (rawQuestions.length === 0) return undefined

    const questions = rawQuestions.map(mapToQuestionConfig)
    const toolCallId = part.toolCallId

    return {
      id: toolCallId ?? "pending-question",
      questions,
      submitLabel: "Continue",
      allowSkip: true,
      onSubmit: (answer: QuestionAnswer) => {
        answerQuestion({ toolCallId, answer })
      },
    }
  }, [messages, answerQuestion])
}

function findPendingQuestionPart(messages: Array<ChatMessageLike>) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== "assistant" || !Array.isArray(msg.parts)) continue

    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j] as ToolQuestionPart | undefined
      if (part?.type !== "tool-Question") continue
      if (isPending(part)) return { part }
    }
  }
  return undefined
}

function isPending(part: ToolQuestionPart): boolean {
  if (part.state === "output-available" || part.state === "output-error")
    return false
  const output = part.output
  if (!output) return true
  if (output.answer) return false
  if (Array.isArray(output.answers) && output.answers.length > 0) return false
  // Normalized tool output uses content + details, not answer/answers
  if (typeof output.content === "string" && output.content.length > 0)
    return false
  return true
}

type RawQuestion = {
  id?: string
  prompt?: string
  title?: string
  options?: Array<{
    value?: string
    label?: string
    description?: string
  }>
  allowOther?: boolean
  allowCustom?: boolean
  kind?: "single" | "multi" | "text"
}

function mapToQuestionConfig(raw: RawQuestion): QuestionConfig {
  const options: Array<QuestionOption> = (raw.options ?? []).map((opt) => ({
    id: opt.value,
    value: opt.value,
    label: opt.label ?? opt.value ?? "",
    description: opt.description,
  }))

  const kind: QuestionConfig["kind"] =
    raw.kind ?? (options.length > 0 ? "single" : "text")

  return {
    id: raw.id,
    kind,
    title: raw.prompt ?? raw.title ?? "",
    options: options.length > 0 ? options : undefined,
    allowCustom: raw.allowOther ?? raw.allowCustom,
  }
}
