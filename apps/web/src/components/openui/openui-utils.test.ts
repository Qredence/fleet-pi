import { describe, expect, it } from "vitest"

import {
  isOpenUIProgram,
  segmentOpenUIContent,
  stripOpenUIWrapper,
} from "./openui-utils"

describe("OpenUI content utilities", () => {
  it("detects pure and fenced OpenUI programs", () => {
    expect(isOpenUIProgram('root = Root([Text("Hi")])')).toBe(true)
    expect(isOpenUIProgram('```openui\nroot = Root([Text("Hi")])\n```')).toBe(
      true
    )
    expect(isOpenUIProgram("```ts\nroot = path.resolve('.')\n```")).toBe(false)
    expect(isOpenUIProgram("plain markdown")).toBe(false)
  })

  it("strips only OpenUI code fences", () => {
    expect(stripOpenUIWrapper("```openui\nroot = Root([])\n```")).toBe(
      "root = Root([])"
    )
    expect(stripOpenUIWrapper("```ts\nroot = path.resolve('.')\n```")).toBe(
      "```ts\nroot = path.resolve('.')\n```"
    )
  })

  it("segments mixed markdown and OpenUI blocks", () => {
    const segments = segmentOpenUIContent(
      'Before\n```openui\nroot = Root([body])\nbody = Text("Hi")\n```\nAfter'
    )

    expect(segments).toEqual([
      { type: "markdown", content: "Before\n" },
      { type: "openui", content: 'root = Root([body])\nbody = Text("Hi")' },
      { type: "markdown", content: "\nAfter" },
    ])
  })

  it("leaves non-OpenUI fenced code as markdown", () => {
    const content = "```ts\nroot = path.resolve('.')\n```"

    expect(segmentOpenUIContent(content)).toEqual([
      { type: "markdown", content },
    ])
  })
})
