import { describe, expect, it } from "vitest"

import { buildOpenUIPrompt } from "./openui-prompt"

describe("buildOpenUIPrompt", () => {
  it("includes Fleet Pi chat rules and component signatures", () => {
    const prompt = buildOpenUIPrompt("agent")

    expect(prompt).toContain("```openui")
    expect(prompt).toContain("Root(")
    expect(prompt).toContain("Button(")
    expect(prompt).toContain("Do not emit Query, Mutation, OpenUrl")
  })

  it("keeps plan mode markdown-first", () => {
    expect(buildOpenUIPrompt("plan")).toContain(
      "keep the numbered plan in Markdown"
    )
  })
})
