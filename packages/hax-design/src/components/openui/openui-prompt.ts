import { generatePrompt } from "@openuidev/lang-core"

import { openUIPromptSpec } from "./openui-signatures"

export type OpenUIPromptMode = "agent" | "harness" | "plan" | "plan-execution"

const OPENUI_PREAMBLE =
  "You are an AI assistant that can include openui-lang blocks inside normal chat responses."

const OPENUI_FENCE_RULE =
  "When rendering generative UI inline, wrap the OpenUI Lang program in a fenced ```openui code block. Do not make the entire response OpenUI unless the user explicitly asks for only UI."

const BASE_RULES = [
  OPENUI_FENCE_RULE,
  "Every OpenUI block must start with `root = Root(...)` as its first line.",
  "Use only the components listed in the generated component signatures; never invent component names or named arguments.",
  'Arguments are positional. For example, write `Card("Title", child)` rather than `Card(title: "Title", content: child)`.',
  "Use Markdown for prose, explanations, and code unless a visual card, table, metric, chart, or action row would be clearer.",
  "Prefer compact UI blocks that fit inside a chat message.",
]

const PLAN_RULES = [
  "In Plan mode, keep the numbered plan in Markdown. Use OpenUI only for optional visual summaries, status cards, or small decision aids.",
  "Do not use OpenUI actions in Plan mode.",
]

const AGENT_RULES = [
  "Use OpenUI for dashboards, structured comparisons, progress/status summaries, result cards, metrics, and safe conversational buttons.",
  "Buttons may send a conversational message back to the assistant; do not use them for destructive actions.",
  "Do not emit Query, Mutation, OpenUrl, or arbitrary tool/network actions.",
]

const EXAMPLES = [
  `A compact status summary:
\`\`\`openui
root = Root([summary])
summary = Card("OpenUI status", Stack([ok, next]))
ok = Badge("Renderer wired", "success")
next = Text("Next: validate streamed fenced blocks.", "muted")
\`\`\``,
  `A conversational action row:
\`\`\`openui
root = Root([card])
card = Card("Continue?", Stack([body, actions]))
body = Text("I can explain the implementation or run validation next.")
actions = Group([explain, validate])
explain = Button("Explain implementation", "Tell me how this OpenUI integration works", "outline")
validate = Button("Run validation", "Run the OpenUI validation checks", "default")
\`\`\``,
]

export function buildOpenUIPrompt(mode: OpenUIPromptMode) {
  const additionalRules = [
    ...BASE_RULES,
    ...(mode === "plan" ? PLAN_RULES : AGENT_RULES),
  ]

  return generatePrompt({
    ...openUIPromptSpec,
    preamble: OPENUI_PREAMBLE,
    additionalRules,
    examples: EXAMPLES,
  })
}
