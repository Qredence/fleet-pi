import { describe, expect, it } from "vitest"
import {
  assistantMessageHasPendingQuestion,
  isQuestionToolPartPending,
} from "./question-pending"

describe("isQuestionToolPartPending", () => {
  it("returns false for non-question parts", () => {
    expect(isQuestionToolPartPending({ type: "text" })).toBe(false)
  })

  it("returns true when question has no output", () => {
    expect(
      isQuestionToolPartPending({
        type: "tool-Question",
        state: "input-available",
      })
    ).toBe(true)
  })

  it("returns false when output is available", () => {
    expect(
      isQuestionToolPartPending({
        type: "tool-Question",
        state: "output-available",
      })
    ).toBe(false)
  })

  it("returns false when answer is present", () => {
    expect(
      isQuestionToolPartPending({
        type: "tool-Question",
        output: { answer: "yes" },
      })
    ).toBe(false)
  })

  it("returns false when answer is falsy but defined", () => {
    expect(
      isQuestionToolPartPending({
        type: "tool-Question",
        output: { answer: false },
      })
    ).toBe(false)
    expect(
      isQuestionToolPartPending({
        type: "tool-Question",
        output: { answer: 0 },
      })
    ).toBe(false)
  })

  it("returns false when answers array is populated", () => {
    expect(
      isQuestionToolPartPending({
        type: "tool-Question",
        output: { answers: ["a"] },
      })
    ).toBe(false)
  })

  it("returns false when normalized content is present", () => {
    expect(
      isQuestionToolPartPending({
        type: "tool-Question",
        output: { content: "answered" },
      })
    ).toBe(false)
  })
})

describe("assistantMessageHasPendingQuestion", () => {
  it("returns false for missing or non-assistant messages", () => {
    expect(assistantMessageHasPendingQuestion(undefined)).toBe(false)
    expect(
      assistantMessageHasPendingQuestion({ role: "user", parts: [] })
    ).toBe(false)
  })

  it("returns true when any question part is pending", () => {
    expect(
      assistantMessageHasPendingQuestion({
        role: "assistant",
        parts: [
          { type: "text" },
          { type: "tool-Question", state: "input-available" },
        ],
      })
    ).toBe(true)
  })

  it("returns false when all question parts are answered", () => {
    expect(
      assistantMessageHasPendingQuestion({
        role: "assistant",
        parts: [
          {
            type: "tool-Question",
            output: { answer: "done" },
          },
        ],
      })
    ).toBe(false)
  })
})
