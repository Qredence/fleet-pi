import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import workspaceContextExtension from "../../../../../../.pi/extensions/workspace-context"

const PROJECT_MEMORY_DIR = "agent-workspace/memory/project"
const tempRoots: Array<string> = []

describe("workspace context extension", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => rm(root, { recursive: true }))
    )
  })

  it("rebuilds the retained workspace context from the latest user prompt", async () => {
    const root = await createTempWorkspace()
    await writeMemoryFile(
      root,
      "architecture.md",
      [
        "# Architecture",
        "",
        "## Runtime",
        "",
        "- Value: Sandbox startup latency depends on Daytona volume initialization",
      ].join("\n")
    )
    await writeMemoryFile(
      root,
      "preferences.md",
      [
        "# Preferences",
        "",
        "## UX",
        "",
        "- Preference: Keep pill-shaped header chrome",
      ].join("\n")
    )

    const handlers = new Map<string, (...args: Array<unknown>) => unknown>()
    workspaceContextExtension({
      on: (event: string, handler: (...args: Array<unknown>) => unknown) => {
        handlers.set(event, handler)
      },
    } as never)

    const beforeAgentStart = handlers.get("before_agent_start")
    const context = handlers.get("context")

    expect(beforeAgentStart).toBeTypeOf("function")
    expect(context).toBeTypeOf("function")

    const initial = (await beforeAgentStart?.(
      {},
      { sessionManager: { getCwd: () => root } }
    )) as { message?: { content?: string } } | undefined

    const result = (await context?.(
      {
        messages: [
          { role: "user", content: "How should the header chrome look?" },
          {
            role: "user",
            content: "How do we reduce sandbox startup latency?",
          },
          {
            customType: "workspace-context",
            content: initial?.message?.content ?? "",
          },
        ],
      },
      { sessionManager: { getCwd: () => root } }
    )) as { messages?: Array<{ content?: string }> } | undefined

    const updatedContent = result?.messages?.[2]?.content as string
    const sandboxSnippet =
      "Sandbox startup latency depends on Daytona volume initialization"
    const chromeSnippet = "Preference: Keep pill-shaped header chrome"

    expect(updatedContent).toContain(sandboxSnippet)
    expect(updatedContent).toContain(chromeSnippet)
    expect(updatedContent.indexOf(sandboxSnippet)).toBeLessThan(
      updatedContent.indexOf(chromeSnippet)
    )
  })

  it("uses a short boot section and does not inline workspace policy files", async () => {
    const root = await createTempWorkspace()
    await mkdir(join(root, "agent-workspace/system"), { recursive: true })
    await writeFile(
      join(root, "agent-workspace/AGENTS.md"),
      "You are a repo-local implementation partner: you read before editing.\n",
      "utf8"
    )
    await writeFile(
      join(root, "agent-workspace/system/constraints.md"),
      "Self-imposed operating constraints for the Fleet Pi coding agent.\n",
      "utf8"
    )

    const handlers = new Map<string, (...args: Array<unknown>) => unknown>()
    workspaceContextExtension({
      on: (event: string, handler: (...args: Array<unknown>) => unknown) => {
        handlers.set(event, handler)
      },
    } as never)
    const beforeAgentStart = handlers.get("before_agent_start")
    const result = (await beforeAgentStart?.(
      {},
      { sessionManager: { getCwd: () => root } }
    )) as { message?: { content?: string } } | undefined
    const content = result?.message?.content ?? ""

    expect(content).toContain("system/workspace-policy.md")
    expect(content).toContain("system/constraints.md")
    expect(content).toContain("memory/project/")
    expect(content).not.toContain("repo-local implementation partner")
    expect(content).not.toContain("Self-imposed operating constraints")
  })
})

async function createTempWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "fleet-pi-workspace-context-"))
  tempRoots.push(root)
  return root
}

async function writeMemoryFile(root: string, name: string, content: string) {
  await mkdir(join(root, PROJECT_MEMORY_DIR), { recursive: true })
  await writeFile(join(root, PROJECT_MEMORY_DIR, name), content, "utf8")
}
