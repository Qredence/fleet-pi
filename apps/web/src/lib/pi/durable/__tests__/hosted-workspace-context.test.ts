import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node"
import { describe, expect, it } from "vitest"

import {
  createHostedTrace,
  createScriptedSandboxPort,
  hostedModels,
  openHostedHarness,
} from "@/lib/pi/durable/hosted-harness"
import {
  HOSTED_CONTEXT_LIMITS,
  affectsWorkspaceContext,
  createHostedWorkspaceContext,
  expandHostedPromptTemplate,
  parseFrontmatter,
} from "@/lib/pi/durable/hosted-workspace-context"

import {
  formatProjectMemoryForStartupContext,
  readProjectMemoryIndex,
} from "../../../../../../../.pi/extensions/lib/workspace-memory-index"

import type { HostedWorkspaceReader } from "@/lib/pi/durable/hosted-workspace-context"

type Files = Record<string, string>

/** In-memory workspace reader that counts reads. */
function fakeReader(files: Files) {
  const reads: Array<string> = []
  const reader: HostedWorkspaceReader = {
    read: (path) => {
      reads.push(path)
      return Promise.resolve(files[path])
    },
    list: (dir) => {
      const prefix = `${dir}/`
      const children = new Map<string, boolean>()
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) continue
        const [name, ...rest] = path.slice(prefix.length).split("/")
        children.set(name, rest.length > 0 || children.get(name) === true)
      }
      return Promise.resolve(
        [...children].map(([name, isDirectory]) => ({ name, isDirectory }))
      )
    },
  }
  return { reader, reads }
}

type RenderableSection = {
  key: string
  render: (input: never, context: never) => unknown
}

async function renderSections(
  context: ReturnType<typeof createHostedWorkspaceContext>
) {
  const sections = (context.extension.sections ??
    []) as unknown as Array<RenderableSection>
  const rendered: Record<string, string | undefined> = {}
  for (const section of sections) {
    rendered[section.key] = (await section.render({} as never, {} as never)) as
      | string
      | undefined
  }
  return rendered
}

const MEMORY: Files = {
  "memory/project/decisions.md":
    "# Decisions\n\n- We deploy previews from the staging branch.\n- Billing uses Stripe webhooks.\n",
  "memory/project/preferences.md":
    "# Preferences\n\n- The user prefers small pull requests.\n",
  "memory/project/scratchpad.md": "# Scratchpad\n\n- an orphaned note\n",
}

describe("hosted workspace context sections", () => {
  it("renders policy files in order and maps memory to tool paths", async () => {
    const { reader } = fakeReader({
      "AGENTS.md": "# Agent Workspace\nRead before writing.",
      "system/identity.md": "# Identity\nYou help one user.",
      ...MEMORY,
    })
    const context = createHostedWorkspaceContext(reader)
    context.beginTurn("how do we deploy previews?")
    const rendered = await renderSections(context)

    const workspace = rendered.workspace ?? ""
    expect(workspace.indexOf("--- AGENTS.md ---")).toBeLessThan(
      workspace.indexOf("--- system/identity.md ---")
    )
    expect(workspace).toContain("You help one user.")

    const memory = rendered["project-memory"] ?? ""
    expect(memory).toContain("memory/project/decisions.md")
    expect(memory).not.toContain("agent-workspace/")
    expect(memory.indexOf("deploy previews")).toBeLessThan(
      memory.indexOf("Billing uses Stripe")
    )
    expect(memory).toContain("orphaned: scratchpad.md")
  })

  it("falls back to a short rule set when the workspace has no policy", async () => {
    const context = createHostedWorkspaceContext(fakeReader({}).reader)
    const rendered = await renderSections(context)

    expect(rendered.workspace).toContain("has no AGENTS.md or system/ policy")
    expect(rendered["workspace-skills"]).toBeUndefined()
  })

  it("caps each policy file and the policy total", async () => {
    const huge = "x".repeat(HOSTED_CONTEXT_LIMITS.policyFileChars * 2)
    const { reader } = fakeReader({
      "AGENTS.md": huge,
      "system/identity.md": huge,
      "system/behavior.md": huge,
      "system/constraints.md": huge,
    })
    const rendered = await renderSections(createHostedWorkspaceContext(reader))

    const workspace = rendered.workspace ?? ""
    expect(workspace.length).toBeLessThan(
      HOSTED_CONTEXT_LIMITS.policyTotalChars + 1000
    )
    expect(workspace).toContain("…")
  })

  it("indexes skills with a description and skips unsafe or empty ones", async () => {
    const { reader } = fakeReader({
      "pi/skills/plan/SKILL.md":
        "---\nname: execution-plan\ndescription: Write a resumable plan.\n---\n# Plan\n",
      "pi/skills/blank/SKILL.md": "# No frontmatter\n",
      "pi/skills/..hidden/SKILL.md":
        "---\nname: x\ndescription: should not load\n---\n",
    })
    const rendered = await renderSections(createHostedWorkspaceContext(reader))

    expect(rendered["workspace-skills"]).toContain(
      "- execution-plan: Write a resumable plan. (pi/skills/plan/SKILL.md)"
    )
    expect(rendered["workspace-skills"]).not.toContain("blank")
    expect(rendered["workspace-skills"]).not.toContain("should not load")
  })

  it("reads the workspace once per turn and again after a relevant write", async () => {
    const { reader, reads } = fakeReader({
      "AGENTS.md": "rules",
      ...MEMORY,
    })
    const context = createHostedWorkspaceContext(reader)
    context.beginTurn("first")
    await renderSections(context)
    const afterFirst = reads.length
    await renderSections(context)
    expect(reads.length).toBe(afterFirst)

    context.noteWrite("scratch/notes.md")
    await renderSections(context)
    expect(reads.length).toBe(afterFirst)

    context.noteWrite("memory/project/decisions.md")
    await renderSections(context)
    expect(reads.length).toBe(afterFirst * 2)

    context.beginTurn("second")
    await renderSections(context)
    expect(reads.length).toBe(afterFirst * 3)
  })

  it("classifies which writes change the rendered context", () => {
    expect(affectsWorkspaceContext("AGENTS.md")).toBe(true)
    expect(affectsWorkspaceContext("./system/identity.md")).toBe(true)
    expect(
      affectsWorkspaceContext(
        "/home/daytona/agent-workspace/memory/project/a.md"
      )
    ).toBe(true)
    expect(
      affectsWorkspaceContext("agent-workspace/pi/skills/x/SKILL.md")
    ).toBe(true)
    expect(affectsWorkspaceContext("memory/daily/2026-11-09.md")).toBe(false)
    expect(affectsWorkspaceContext("scratch/tmp/a")).toBe(false)
  })
})

describe("hosted memory parity with the local extension", () => {
  it("renders the same memory block as the local reader", async () => {
    const root = mkdtempSync(join(tmpdir(), "fleet-memory-parity-"))
    try {
      for (const [path, content] of Object.entries(MEMORY)) {
        const target = join(root, "agent-workspace", path)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, content)
      }
      const prompt = "who handles billing webhooks?"
      const local = formatProjectMemoryForStartupContext(
        await readProjectMemoryIndex(root),
        prompt
      )

      const context = createHostedWorkspaceContext(fakeReader(MEMORY).reader)
      context.beginTurn(prompt)
      const hosted = (await renderSections(context))["project-memory"]

      expect(hosted).toBe(local.replaceAll("agent-workspace/", ""))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe("hosted prompt templates", () => {
  const { reader } = fakeReader({
    "pi/prompts/review.md":
      "---\ndescription: Review a file\n---\nReview $1 carefully. All args: $ARGUMENTS",
  })

  it("expands /name with positional and full arguments", async () => {
    await expect(
      expandHostedPromptTemplate("/review src/app.ts fast", reader)
    ).resolves.toBe("Review src/app.ts carefully. All args: src/app.ts fast")
  })

  it("leaves plain prompts and unknown or unsafe templates alone", async () => {
    for (const prompt of ["hello", "/missing now", "/../etc/passwd", "/"]) {
      await expect(expandHostedPromptTemplate(prompt, reader)).resolves.toBe(
        prompt
      )
    }
  })

  it("parses flat frontmatter with quotes", () => {
    expect(
      parseFrontmatter("---\nname: \"demo\"\ndescription: 'a b'\n---\nbody")
    ).toEqual({ name: "demo", description: "a b" })
  })
})

async function storage() {
  const dir = mkdtempSync(join(tmpdir(), "fleet-pi-context-"))
  return openNodeSqliteStorage(join(dir, "context.sqlite"))
}

function capturingModels() {
  const requests: Array<string> = []
  const models = {
    ...hostedModels,
    streamSimple(model: { id?: string } | undefined, request: unknown) {
      requests.push(JSON.stringify(request))
      return hostedModels.streamSimple(model)
    },
  }
  return { models, requests }
}

describe("hosted harness workspace context", () => {
  it("sends workspace policy, memory, and skills to the model on a sandbox turn", async () => {
    const port = createScriptedSandboxPort(createHostedTrace(), {
      "AGENTS.md": "WORKSPACE-RULES-MARKER",
      "memory/project/preferences.md": "# Preferences\n\n- PREFERENCE-MARKER\n",
      "pi/skills/plan/SKILL.md":
        "---\nname: plan\ndescription: SKILL-MARKER\n---\n",
      "pi/prompts/hello.md": "TEMPLATE-MARKER for $1",
    })
    const { models, requests } = capturingModels()
    const harness = await openHostedHarness(await storage(), "sandbox", port, {
      models,
    })

    await harness.runAgentTurn({
      prompt: "/hello world",
      create: true,
      model: { provider: "hosted", modelId: "hosted" },
      onView: () => undefined,
    })

    const request = requests.at(-1) ?? ""
    expect(request).toContain("WORKSPACE-RULES-MARKER")
    expect(request).toContain("PREFERENCE-MARKER")
    expect(request).toContain("SKILL-MARKER")
    expect(request).toContain("TEMPLATE-MARKER for world")
  })

  it("adds no workspace context on a model-only turn", async () => {
    const port = createScriptedSandboxPort(createHostedTrace(), {
      "AGENTS.md": "WORKSPACE-RULES-MARKER",
    })
    const { models, requests } = capturingModels()
    const harness = await openHostedHarness(
      await storage(),
      "model-only",
      port,
      { models }
    )

    await harness.runAgentTurn({
      prompt: "hi",
      create: true,
      model: { provider: "hosted", modelId: "hosted" },
      onView: () => undefined,
    })

    expect(requests.at(-1) ?? "").not.toContain("WORKSPACE-RULES-MARKER")
  })
})
