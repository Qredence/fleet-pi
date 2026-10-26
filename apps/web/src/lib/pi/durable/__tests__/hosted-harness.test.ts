import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node"
import { describe, expect, it } from "vitest"
import type { executeCommand } from "@/lib/daytona/client"
import { daytonaSandboxPort } from "@/lib/pi/durable/hosted-sandbox"
import {
  HOSTED_ECHO_TEXT,
  HOSTED_MODEL_REPLY,
  createHostedTrace,
  createScriptedSandboxPort,
  openHostedHarness,
  toolsForChatMode,
  waitForCount,
} from "@/lib/pi/durable/hosted-harness"

async function sqliteFile(name: string) {
  const dir = mkdtempSync(join(tmpdir(), "fleet-pi-hosted-"))
  return openNodeSqliteStorage(join(dir, name))
}

describe("Pi Durable hosted harness", () => {
  it("offers read and search in plan mode and no tools without a sandbox", () => {
    const tools = [
      { name: "read" },
      { name: "search" },
      { name: "write" },
      { name: "edit" },
      { name: "bash" },
    ]
    expect(
      toolsForChatMode(tools, "plan", true).map((tool) => tool.name)
    ).toEqual(["read", "search"])
    expect(toolsForChatMode(tools, "agent", false)).toEqual([])
    expect(toolsForChatMode(tools, "harness", true)).toHaveLength(5)
  })

  it("keeps the same root conversation after another harness opens the file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fleet-pi-hosted-"))
    const file = join(dir, "root.sqlite")
    const port = createScriptedSandboxPort(createHostedTrace())
    const first = await openHostedHarness(
      await openNodeSqliteStorage(file),
      "sandbox",
      port
    )
    const rootId = await first.rootId()
    const echo = await first.runEcho()
    const second = await openHostedHarness(
      await openNodeSqliteStorage(file),
      "sandbox",
      port
    )

    expect(echo.rootId).toBe(rootId)
    expect(await second.rootId()).toBe(rootId)
    expect(await second.transcript()).toContain(HOSTED_ECHO_TEXT)
  })

  it("replays a safe read once and does not rerun an interrupted bash", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fleet-pi-hosted-"))
    const readTrace = createHostedTrace()
    readTrace.hang = true
    const readPort = createScriptedSandboxPort(readTrace)
    const readFile = join(dir, "read.sqlite")
    const reading = await openHostedHarness(
      await openNodeSqliteStorage(readFile),
      "sandbox",
      readPort
    )
    await reading.beginHanging("read")
    await waitForCount(() => readTrace.reads, 1)
    const reread = await openHostedHarness(
      await openNodeSqliteStorage(readFile),
      "sandbox",
      readPort
    )
    reread.resume()
    await waitForCount(() => readTrace.reads, 2)

    const bashTrace = createHostedTrace()
    bashTrace.hang = true
    const bashPort = createScriptedSandboxPort(bashTrace)
    const bashFile = join(dir, "bash.sqlite")
    const running = await openHostedHarness(
      await openNodeSqliteStorage(bashFile),
      "sandbox",
      bashPort
    )
    await running.beginHanging("bash")
    await waitForCount(() => bashTrace.bashes, 1)
    const resumed = await openHostedHarness(
      await openNodeSqliteStorage(bashFile),
      "sandbox",
      bashPort
    )
    resumed.resume()
    const started = Date.now()
    let transcript = ""
    while (!transcript.includes("interrupted") && Date.now() - started < 4000) {
      transcript = await resumed.transcript()
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    expect(readTrace.reads).toBe(2)
    expect(bashTrace.bashes).toBe(1)
    expect(transcript).toContain(
      "Tool bash was interrupted and may have partially run"
    )
  })

  it("blocks a bash command aimed at a protected workspace path", async () => {
    const trace = createHostedTrace()
    const harness = await openHostedHarness(
      await sqliteFile("guard.sqlite"),
      "sandbox",
      createScriptedSandboxPort(trace)
    )
    const transcript = await harness.runBlockedBash("rm system/identity.md")

    expect(transcript).toContain("protected")
    expect(trace.bashes).toBe(0)
  })

  it("stops runAgentTurn when the abort signal is already aborted", async () => {
    const harness = await openHostedHarness(
      await sqliteFile("abort.sqlite"),
      "model-only",
      createScriptedSandboxPort(createHostedTrace())
    )
    const controller = new AbortController()
    controller.abort()
    await expect(
      harness.runAgentTurn({
        prompt: "hello",
        create: true,
        model: { provider: "hosted", modelId: "hosted" },
        onView: () => undefined,
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" })
  })

  it("accepts a model reply when sandbox tools are absent", async () => {
    const harness = await openHostedHarness(
      await sqliteFile("model.sqlite"),
      "model-only",
      createScriptedSandboxPort(createHostedTrace())
    )
    const transcript = await harness.modelReply("hello")

    expect(harness.toolNames).not.toContain("bash")
    expect(harness.toolNames).not.toContain("write")
    expect(harness.toolNames).not.toContain("edit")
    expect(transcript).toContain(HOSTED_MODEL_REPLY)
  })

  it("applies saved thinking level and retry max on a new conversation and a resumed open", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fleet-pi-hosted-"))
    const file = join(dir, "loop.sqlite")
    const loop = {
      thinkingLevel: "high" as const,
      retry: { maxRetries: 7 },
      compaction: { reserveTokens: 111 },
    }
    const open = async () =>
      openHostedHarness(
        await openNodeSqliteStorage(file),
        "model-only",
        createScriptedSandboxPort(createHostedTrace()),
        { loop }
      )
    const harness = await open()

    expect(harness.appliedSettings?.retry?.maxRetries).toBe(7)
    expect(harness.appliedSettings?.compaction?.reserveTokens).toBe(111)
    const turn = await harness.runAgentTurn({
      prompt: "hello",
      create: true,
      model: { provider: "hosted", modelId: "hosted" },
      onView: () => undefined,
    })
    expect(turn.thinkingLevel).toBe("high")

    const resumed = await open()
    expect(resumed.appliedSettings?.retry?.maxRetries).toBe(7)
    expect(resumed.appliedSettings?.compaction?.reserveTokens).toBe(111)
  })

  it("loads code mode, an activated extension, and one HTTPS MCP tool", async () => {
    const plain = await openHostedHarness(
      await sqliteFile("plain-tools.sqlite"),
      "sandbox",
      createScriptedSandboxPort(createHostedTrace())
    )
    expect(plain.toolNames).not.toContain("codemode")
    expect(plain.toolNames).not.toContain("workspace_status")
    expect(plain.toolNames).not.toContain("docs_list")

    const httpOnly = await openHostedHarness(
      await sqliteFile("http-mcp.sqlite"),
      "sandbox",
      createScriptedSandboxPort(createHostedTrace()),
      { mcpServers: [{ name: "docs", url: "http://example.com/mcp" }] }
    )
    expect(httpOnly.toolNames).not.toContain("docs_list")

    const expanded = await openHostedHarness(
      await sqliteFile("expanded-tools.sqlite"),
      "sandbox",
      createScriptedSandboxPort(createHostedTrace()),
      {
        codemode: true,
        extensions: ["workspace-status"],
        mcpServers: [{ name: "docs", url: "https://example.com/mcp" }],
      }
    )
    expect(expanded.toolNames).toEqual(
      expect.arrayContaining(["codemode", "workspace_status", "docs_list"])
    )
    expect(
      toolsForChatMode(
        expanded.toolNames.map((name) => ({ name })),
        "plan",
        true
      ).map((tool) => tool.name)
    ).toEqual(["read", "search"])
  })

  it("sends bash through the Daytona sandbox port and enforces workspace path bounds", async () => {
    const commands: Array<string> = []
    const downloadedPaths: Array<string> = []
    const sandbox = {
      process: {
        executeCommand: (command: string) => {
          commands.push(command)
          return Promise.resolve({ result: "from-daytona\n", exitCode: 0 })
        },
      },
      fs: {
        downloadFile: (path: string) => {
          downloadedPaths.push(path)
          return Promise.resolve(Buffer.from("body"))
        },
        uploadFile: () => Promise.resolve(),
      },
    } as unknown as Parameters<typeof executeCommand>[0]
    const port = daytonaSandboxPort(sandbox)

    const result = await port.exec("echo fleet-pi")
    const body = await port.read("notes.txt")

    expect(commands).toEqual(["echo fleet-pi"])
    expect(result.output).toBe("from-daytona\n")
    expect(body).toBe("body")
    expect(downloadedPaths).toEqual(["/home/daytona/agent-workspace/notes.txt"])
    await expect(port.read("/etc/passwd")).rejects.toThrow(
      /escapes workspace bound/
    )
    await expect(port.write("../../etc/passwd", "x")).rejects.toThrow(
      /escapes workspace bound/
    )
  })
})
