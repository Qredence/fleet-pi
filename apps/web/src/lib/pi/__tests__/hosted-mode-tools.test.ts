import { describe, expect, it } from "vitest"
import { hostedWhenBusy } from "../hosted-busy-delivery"
import {
  hostedBashBlock,
  hostedPathBlock,
  hostedWriteBlock,
} from "../durable/hosted-tool-registry"
import { toolsForChatMode } from "../durable/hosted-harness"

describe("hosted mode tools", () => {
  it("keeps plan read-only and requires confirmation before harness writes system or evals", () => {
    const tools = [
      { name: "read" },
      { name: "search" },
      { name: "write" },
      { name: "edit" },
      { name: "bash" },
      { name: "codemode" },
      { name: "docs_list" },
    ]
    expect(
      toolsForChatMode(tools, "plan", true).map((tool) => tool.name)
    ).toEqual(["read", "search"])
    expect(
      toolsForChatMode(tools, "agent", true).map((tool) => tool.name)
    ).toEqual(tools.map((tool) => tool.name))
    expect(
      hostedWriteBlock("harness", "system/identity.md", undefined)
    ).toMatch(/Confirmation required/)
    expect(hostedWriteBlock("harness", "evals/case.md", undefined)).toMatch(
      /Confirmation required/
    )
    expect(
      hostedWriteBlock("harness", "system/identity.md", true)
    ).toBeUndefined()
    expect(hostedWriteBlock("agent", "system/identity.md", true)).toMatch(
      /protected/
    )
    expect(hostedBashBlock("harness", "rm evals/case.md", undefined)).toMatch(
      /Confirmation required/
    )
    expect(
      hostedBashBlock(
        "harness",
        "rm agent-workspace/system/identity.md",
        undefined
      )
    ).toMatch(/Confirmation required/)
    expect(
      hostedBashBlock("harness", "rm system/identity.md", true)
    ).toBeUndefined()
  })

  it("enforces workspace path boundaries and rationale requirements in hosted tools", () => {
    expect(hostedPathBlock("/etc/passwd")).toMatch(/escapes workspace bound/)
    expect(hostedPathBlock("../../etc/passwd")).toMatch(
      /escapes workspace bound/
    )
    expect(hostedPathBlock("notes.txt")).toBeUndefined()
    expect(
      hostedPathBlock("/home/daytona/agent-workspace/scratch/note.md")
    ).toBeUndefined()

    expect(
      hostedWriteBlock("agent", "/etc/passwd", undefined, "reason")
    ).toMatch(/escapes workspace bound/)
    expect(
      hostedWriteBlock("agent", "plans/plan.md", undefined, undefined)
    ).toMatch(/without a rationale/)
    expect(
      hostedWriteBlock(
        "agent",
        "plans/plan.md",
        undefined,
        "Create implementation plan"
      )
    ).toBeUndefined()
  })

  it("steers when the saved mode drains all prompts and waits otherwise", () => {
    expect(hostedWhenBusy({ hostedAgentOnly: true, steeringMode: "all" })).toBe(
      "steer"
    )
    expect(
      hostedWhenBusy({
        hostedAgentOnly: true,
        steeringMode: "one-at-a-time",
      })
    ).toBe("followUp")
    expect(
      hostedWhenBusy({ hostedAgentOnly: false, steeringMode: "all" })
    ).toBe("followUp")
  })
})
