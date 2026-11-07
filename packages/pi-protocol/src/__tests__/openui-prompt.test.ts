import { describe, expect, it } from "vitest"

import { buildOpenUIPrompt } from "../openui-prompt"

describe("buildOpenUIPrompt", () => {
  it("includes Fleet Pi chat rules and component signatures", () => {
    const prompt = buildOpenUIPrompt("agent")

    expect(prompt).toContain("```openui")
    expect(prompt).toContain("Root(")
    expect(prompt).toContain("Button(")
    expect(prompt).toContain("Reactive State ($variables)")
    expect(prompt).toContain('@ToAssistant("Explain this chart")')
    expect(prompt).toContain("@Set(")
    expect(prompt).toContain("Do not use @OpenUrl")
    expect(prompt).not.toContain("@Run(")
    expect(prompt).not.toContain("Query(")
    expect(prompt).not.toContain("Mutation(")
  })

  it("keeps plan mode markdown-first", () => {
    const plan = buildOpenUIPrompt("plan")

    expect(plan).toContain("```openui")
    expect(plan).toContain("keep the numbered plan in Markdown")
    expect(plan).toContain("Do not use OpenUI actions in Plan mode.")
    expect(plan).not.toContain("Explain this chart")
    expect(plan).not.toContain("Apply Filters")
    expect(plan).not.toContain("Do not use @OpenUrl")
  })
})
