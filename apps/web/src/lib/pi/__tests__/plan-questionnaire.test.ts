import { describe, expect, it } from "vitest"
import {
  registerPlanQuestionnaireTool,
  resolveQuestionnaireAnswer,
} from "../plan-questionnaire"

type RegisteredTool = {
  name: string
  execute: (
    toolCallId: string,
    params: unknown,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: unknown
  ) => Promise<unknown>
}

function registerTool() {
  let registeredTool: RegisteredTool | undefined
  registerPlanQuestionnaireTool({
    registerTool: (tool: RegisteredTool) => {
      registeredTool = tool
    },
  } as never)

  if (!registeredTool) {
    throw new Error("questionnaire tool was not registered")
  }

  return registeredTool
}

function createContext(sessionId = "session-1") {
  return {
    sessionManager: {
      getSessionId: () => sessionId,
    },
  }
}

const questionnaireParams = {
  questions: [
    {
      id: "priority",
      prompt: "Which area should be covered first?",
      options: [
        { value: "runtime", label: "Runtime" },
        { value: "ui", label: "UI" },
      ],
      allowOther: true,
    },
    {
      id: "target",
      prompt: "What target should be used?",
      options: [
        { value: "fast", label: "Fast gate" },
        { value: "broad", label: "Broad confidence" },
      ],
    },
  ],
}

describe("plan questionnaire tool", () => {
  it("registers a sequential questionnaire tool", () => {
    const tool = registerTool()

    expect(tool.name).toBe("questionnaire")
    expect(tool).toMatchObject({
      label: "Questionnaire",
      executionMode: "sequential",
    })
  })

  it("returns an error result when no questions are provided", async () => {
    const tool = registerTool()

    await expect(
      tool.execute(
        "tool-empty",
        { questions: [] },
        undefined,
        undefined,
        createContext()
      )
    ).resolves.toMatchObject({
      isError: true,
      details: { questions: [], answers: [], cancelled: true },
    })
  })

  it("normalizes selected option answers and custom text", async () => {
    const tool = registerTool()
    const resultPromise = tool.execute(
      "tool-answer",
      questionnaireParams,
      undefined,
      undefined,
      createContext()
    )

    expect(
      resolveQuestionnaireAnswer("tool-answer", {
        kind: "multi",
        questionId: "priority",
        selectedIds: ["runtime"],
        text: "Settings too",
      })
    ).toBe(true)

    await expect(resultPromise).resolves.toMatchObject({
      content: [
        {
          text: "User answered: Runtime, Settings too",
        },
      ],
      details: {
        cancelled: false,
        answers: [
          {
            id: "priority",
            value: "runtime",
            label: "Runtime",
            wasCustom: false,
          },
          {
            id: "priority",
            value: "Settings too",
            label: "Settings too",
            wasCustom: true,
          },
        ],
      },
    })
  })

  it("infers the question from selected option ids", async () => {
    const tool = registerTool()
    const resultPromise = tool.execute(
      "tool-inferred",
      questionnaireParams,
      undefined,
      undefined,
      createContext()
    )

    resolveQuestionnaireAnswer("tool-inferred", {
      kind: "single",
      selectedIds: ["fast"],
    })

    await expect(resultPromise).resolves.toMatchObject({
      details: {
        answers: [
          {
            id: "target",
            value: "fast",
            label: "Fast gate",
            wasCustom: false,
          },
        ],
      },
    })
  })

  it("supports text-only answers and skipped questions", async () => {
    const tool = registerTool()
    const textPromise = tool.execute(
      "tool-text",
      questionnaireParams,
      undefined,
      undefined,
      createContext()
    )
    resolveQuestionnaireAnswer("tool-text", {
      kind: "text",
      questionId: "target",
      text: "No slow E2E",
    })

    await expect(textPromise).resolves.toMatchObject({
      details: {
        answers: [
          {
            id: "target",
            value: "No slow E2E",
            wasCustom: true,
          },
        ],
      },
    })

    const skipPromise = tool.execute(
      "tool-skip",
      questionnaireParams,
      undefined,
      undefined,
      createContext()
    )
    resolveQuestionnaireAnswer("tool-skip", {
      kind: "skip",
    })

    await expect(skipPromise).resolves.toMatchObject({
      content: [{ text: "User skipped the question." }],
      details: { answers: [], cancelled: true },
    })
  })

  it("cleans up pending questions on abort", async () => {
    const tool = registerTool()
    const controller = new AbortController()
    const resultPromise = tool.execute(
      "tool-abort",
      questionnaireParams,
      controller.signal,
      undefined,
      createContext()
    )

    controller.abort()

    await expect(resultPromise).rejects.toThrow("Question was cancelled.")
    expect(
      resolveQuestionnaireAnswer("tool-abort", {
        kind: "skip",
      })
    ).toBe(false)
  })

  it("ignores missing or unknown tool call ids", () => {
    expect(
      resolveQuestionnaireAnswer(undefined, {
        kind: "skip",
      })
    ).toBe(false)
    expect(
      resolveQuestionnaireAnswer("missing", {
        kind: "skip",
      })
    ).toBe(false)
  })
})
