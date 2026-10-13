import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node"
import { describe, expect, it } from "vitest"
import type { executeCommand } from "@/lib/daytona/client"
import { daytonaSandboxPort } from "@/lib/pi/durable/spike-daytona"
import {
  SPIKE_ECHO_TEXT,
  SPIKE_MODEL_REPLY,
  createScriptedPort,
  createSpikeTrace,
  openSpikeHarness,
  waitForCount,
} from "@/lib/pi/durable/spike-harness"

async function sqliteFile(name: string) {
  const dir = mkdtempSync(join(tmpdir(), "fleet-pi-spike-"))
  return openNodeSqliteStorage(join(dir, name))
}

describe("Pi Durable spike harness", () => {
  it("keeps the same root conversation after another harness opens the file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fleet-pi-spike-"))
    const file = join(dir, "root.sqlite")
    const port = createScriptedPort(createSpikeTrace())
    const first = await openSpikeHarness(
      await openNodeSqliteStorage(file),
      "sandbox",
      port
    )
    const rootId = await first.rootId()
    const echo = await first.runEcho()
    const second = await openSpikeHarness(
      await openNodeSqliteStorage(file),
      "sandbox",
      port
    )

    expect(echo.rootId).toBe(rootId)
    expect(await second.rootId()).toBe(rootId)
    expect(await second.transcript()).toContain(SPIKE_ECHO_TEXT)
  })

  it("replays a safe read once and does not rerun an interrupted bash", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fleet-pi-spike-"))
    const readTrace = createSpikeTrace()
    readTrace.hang = true
    const readPort = createScriptedPort(readTrace)
    const readFile = join(dir, "read.sqlite")
    const reading = await openSpikeHarness(
      await openNodeSqliteStorage(readFile),
      "sandbox",
      readPort
    )
    await reading.beginHanging("read")
    await waitForCount(() => readTrace.reads, 1)
    const reread = await openSpikeHarness(
      await openNodeSqliteStorage(readFile),
      "sandbox",
      readPort
    )
    reread.resume()
    await waitForCount(() => readTrace.reads, 2)

    const bashTrace = createSpikeTrace()
    bashTrace.hang = true
    const bashPort = createScriptedPort(bashTrace)
    const bashFile = join(dir, "bash.sqlite")
    const running = await openSpikeHarness(
      await openNodeSqliteStorage(bashFile),
      "sandbox",
      bashPort
    )
    await running.beginHanging("bash")
    await waitForCount(() => bashTrace.bashes, 1)
    const resumed = await openSpikeHarness(
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
    const trace = createSpikeTrace()
    const harness = await openSpikeHarness(
      await sqliteFile("guard.sqlite"),
      "sandbox",
      createScriptedPort(trace)
    )
    const transcript = await harness.runBlockedBash("rm system/identity.md")

    expect(transcript).toContain("protected")
    expect(trace.bashes).toBe(0)
  })

  it("accepts a model reply when sandbox tools are absent", async () => {
    const harness = await openSpikeHarness(
      await sqliteFile("model.sqlite"),
      "model-only",
      createScriptedPort(createSpikeTrace())
    )
    const transcript = await harness.modelReply("hello")

    expect(harness.toolNames).not.toContain("bash")
    expect(harness.toolNames).not.toContain("write")
    expect(harness.toolNames).not.toContain("edit")
    expect(transcript).toContain(SPIKE_MODEL_REPLY)
  })

  it("sends bash through the Daytona sandbox port", async () => {
    const commands: Array<string> = []
    const sandbox = {
      process: {
        executeCommand: (command: string) => {
          commands.push(command)
          return Promise.resolve({ result: "from-daytona\n", exitCode: 0 })
        },
      },
      fs: {
        downloadFile: () => Promise.resolve(Buffer.from("body")),
        uploadFile: () => Promise.resolve(),
      },
    } as unknown as Parameters<typeof executeCommand>[0]
    const port = daytonaSandboxPort(sandbox)

    const result = await port.exec("echo fleet-pi")
    const body = await port.read("notes.txt")

    expect(commands).toEqual(["echo fleet-pi"])
    expect(result.output).toBe("from-daytona\n")
    expect(body).toBe("body")
  })
})
