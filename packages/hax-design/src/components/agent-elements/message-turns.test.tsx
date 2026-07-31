import { isValidElement } from "react"
import { describe, expect, it } from "vitest"

import { ErrorMessage } from "./error-message"
import { buildAssistantElements } from "./message-turns"
import type { CustomToolRendererProps } from "./types"
import type { ReactElement, ReactNode } from "react"
import type { ToolRendererProps } from "./utils/chat-message-parts"

const StubToolRenderer = (_props: ToolRendererProps) => null
const StubTextRenderer = (_props: {
  content: string
  className?: string
  isStreaming?: boolean
  messageId?: string
  onOpenUIAction?: (message: string) => void
}) => null

const toolRenderers: Record<
  string,
  React.ComponentType<CustomToolRendererProps>
> = {}

function buildOptions(
  overrides: Partial<Parameters<typeof buildAssistantElements>[1]> = {}
): Parameters<typeof buildAssistantElements>[1] {
  return {
    messageId: "m1",
    isLast: false,
    isStreaming: false,
    suppressQuestionTool: false,
    ToolRendererComponent: StubToolRenderer,
    TextRendererComponent: StubTextRenderer,
    toolRenderers,
    ...overrides,
  }
}

type ElementProps = {
  part?: ToolRendererProps["part"]
  nestedTools?: ToolRendererProps["nestedTools"]
  chatStatus?: string
  title?: string
  message?: string
  className?: string
  content?: string
  isStreaming?: boolean
  messageId?: string
  children?: ReactNode
}

function asElement(node: ReactNode): ReactElement<ElementProps> {
  if (!isValidElement(node)) {
    throw new Error("expected a react element")
  }
  return node as ReactElement<ElementProps>
}

describe("buildAssistantElements", () => {
  it("suppresses tool-TaskOutput parts entirely", () => {
    const parts = [
      { type: "tool-TaskOutput", toolCallId: "task1", output: "secret" },
      { type: "text", text: "done" },
    ]
    const elements = buildAssistantElements(parts, buildOptions())

    expect(elements).toHaveLength(1)
    const textWrapper = asElement(elements[0])
    expect(textWrapper.key).toBe("m1-text-final")
    expect(
      elements.some(
        (el) => asElement(el).props.part?.type === "tool-TaskOutput"
      )
    ).toBe(false)
  })

  it("nests subagent child tools under the parent Task part", () => {
    const taskPart = { type: "tool-Task", toolCallId: "task1" }
    const childPart = { type: "tool-Read", toolCallId: "task1:read1" }
    const loosePart = { type: "tool-Bash", toolCallId: "bash1" }
    const elements = buildAssistantElements(
      [taskPart, childPart, loosePart],
      buildOptions()
    )

    expect(elements).toHaveLength(2)
    const taskElement = asElement(
      elements.find((el) => asElement(el).props.part?.toolCallId === "task1")
    )
    expect(taskElement.type).toBe(StubToolRenderer)
    expect(taskElement.props.nestedTools).toEqual([childPart])
    expect(taskElement.props.nestedTools).toHaveLength(1)

    const bashElement = asElement(
      elements.find((el) => asElement(el).props.part?.toolCallId === "bash1")
    )
    // Only Task/Agent parts receive a nestedTools list.
    expect(bashElement.props.nestedTools).toBeUndefined()

    // The child must not render as a standalone top-level card.
    expect(
      elements.some(
        (el) => asElement(el).props.part?.toolCallId === "task1:read1"
      )
    ).toBe(false)
  })

  it("nests children under tool-Agent parents as well", () => {
    const agentPart = { type: "tool-Agent", toolCallId: "agent1" }
    const childPart = { type: "tool-Read", toolCallId: "agent1:read1" }
    const elements = buildAssistantElements(
      [agentPart, childPart],
      buildOptions()
    )

    expect(elements).toHaveLength(1)
    const agentElement = asElement(elements[0])
    expect(agentElement.props.nestedTools).toEqual([childPart])
  })

  it("renders colon-suffixed tools without a matching Task parent as top-level cards", () => {
    const looseChild = { type: "tool-Read", toolCallId: "missing:read1" }
    const elements = buildAssistantElements([looseChild], buildOptions())

    expect(elements).toHaveLength(1)
    const element = asElement(elements[0])
    expect(element.props.part).toBe(looseChild)
    expect(element.props.nestedTools).toBeUndefined()
  })

  it("renders error parts with their title and message intact", () => {
    const parts = [
      { type: "tool-Bash", toolCallId: "bash1" },
      { type: "error", title: "Boom", message: "it failed" },
    ]
    const elements = buildAssistantElements(parts, buildOptions())

    expect(elements).toHaveLength(2)
    const errorElement = asElement(elements[1])
    expect(errorElement.type).toBe(ErrorMessage)
    expect(errorElement.props.title).toBe("Boom")
    expect(errorElement.props.message).toBe("it failed")
    expect(errorElement.key).toBe("m1-error-1")
  })

  it("joins all text parts into one trailing text block", () => {
    const parts = [
      { type: "text", text: "first" },
      { type: "tool-Bash", toolCallId: "bash1" },
      { type: "text", text: "second" },
    ]
    const elements = buildAssistantElements(
      parts,
      buildOptions({ isLast: true, isStreaming: true })
    )

    expect(elements).toHaveLength(2)
    // Tool renders first, joined text always trails.
    const toolElement = asElement(elements[0])
    expect(toolElement.type).toBe(StubToolRenderer)

    const textWrapper = asElement(elements[1])
    expect(textWrapper.type).toBe("div")
    expect(textWrapper.props.className).toBe("group/assistant-text text-[14px]")
    const textElement = asElement(textWrapper.props.children)
    expect(textElement.type).toBe(StubTextRenderer)
    expect(textElement.props.content).toBe("first\n\nsecond")
    expect(textElement.props.isStreaming).toBe(true)
    expect(textElement.props.messageId).toBe("m1")
  })

  it("skips empty text parts and emits no text block when nothing remains", () => {
    const parts = [
      { type: "text", text: "" },
      { type: "tool-Bash", toolCallId: "bash1" },
    ]
    const elements = buildAssistantElements(parts, buildOptions())

    expect(elements).toHaveLength(1)
    const toolElement = asElement(elements[0])
    expect(toolElement.type).toBe(StubToolRenderer)
  })

  it("hides tool-Question parts only when suppressQuestionTool is set", () => {
    const questionPart = { type: "tool-Question", toolCallId: "q1" }

    const suppressed = buildAssistantElements(
      [questionPart],
      buildOptions({ suppressQuestionTool: true })
    )
    expect(suppressed).toHaveLength(0)

    const visible = buildAssistantElements(
      [questionPart],
      buildOptions({ suppressQuestionTool: false })
    )
    expect(visible).toHaveLength(1)
    expect(asElement(visible[0]).props.part).toBe(questionPart)
  })

  it("marks chatStatus streaming only for the last message while streaming", () => {
    const part = { type: "tool-Bash", toolCallId: "bash1" }

    const streamingLast = buildAssistantElements(
      [part],
      buildOptions({ isLast: true, isStreaming: true })
    )
    expect(asElement(streamingLast[0]).props.chatStatus).toBe("streaming")

    const settled = buildAssistantElements(
      [part],
      buildOptions({ isLast: false, isStreaming: true })
    )
    expect(asElement(settled[0]).props.chatStatus).toBeUndefined()

    const notStreaming = buildAssistantElements(
      [part],
      buildOptions({ isLast: true, isStreaming: false })
    )
    expect(asElement(notStreaming[0]).props.chatStatus).toBeUndefined()
  })

  it("keeps tool part keys stable from toolCallId or message-scoped fallback", () => {
    const withId = { type: "tool-Bash", toolCallId: "bash1" }
    const withoutId = { type: "tool-Read" }
    const elements = buildAssistantElements([withId, withoutId], buildOptions())

    expect(asElement(elements[0]).key).toBe("bash1")
    expect(asElement(elements[1]).key).toBe("m1-tool-1")
  })
})
