import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { requireHarnessWriteResolver } from "../../../../../../.pi/extensions/lib/harness-write"
import { installHarnessWriteResolver } from "../harness-write-target"
import {
  trackDaytonaToolSession,
  untrackDaytonaToolSession,
} from "../tool-context"
import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent"

const mocks = vi.hoisted(() => ({
  getCachedUserSandbox: vi.fn(),
  getInFlightUserSandbox: vi.fn(),
  executeCommand: vi.fn(),
  uploadFile: vi.fn(),
  persistHarnessInstallSettings: vi.fn(),
}))

vi.mock("../user-sandbox", () => ({
  getCachedUserSandbox: mocks.getCachedUserSandbox,
  getInFlightUserSandbox: mocks.getInFlightUserSandbox,
}))
vi.mock("../client", () => ({
  executeCommand: mocks.executeCommand,
  uploadFile: mocks.uploadFile,
}))
vi.mock("../harness-settings", () => ({
  persistHarnessInstallSettings: mocks.persistHarnessInstallSettings,
}))

const extensionPaths = ["workspace-write.ts", "resource-install.ts"].map(
  (name) =>
    fileURLToPath(
      new URL(`../../../../../../.pi/extensions/${name}`, import.meta.url)
    )
)
const bridgeKey = Symbol.for("fleet-pi.harness-write")
const bridgeGlobal = globalThis as typeof globalThis & {
  [bridgeKey]?: unknown
}
let originalBridge: unknown
let root: string

beforeEach(async () => {
  vi.resetAllMocks()
  vi.stubEnv("FLEET_PI_DEPLOYMENT", "cloudflare")
  originalBridge = bridgeGlobal[bridgeKey]
  delete bridgeGlobal[bridgeKey]
  root = await mkdtemp(join(tmpdir(), "fleet-pi-harness-loader-"))
  mocks.executeCommand.mockImplementation((_sandbox, command: string) => {
    if (String(command).includes("test -e")) {
      return Promise.resolve({ exitCode: 1, result: "" })
    }
    return Promise.resolve({ exitCode: 0, result: "" })
  })
  mocks.persistHarnessInstallSettings.mockImplementation(({ settings }) =>
    Promise.resolve(settings)
  )
})

afterEach(async () => {
  for (const id of ["session-a", "session-b"])
    untrackDaytonaToolSession(id, undefined)
  if (originalBridge === undefined) delete bridgeGlobal[bridgeKey]
  else bridgeGlobal[bridgeKey] = originalBridge
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

function toolContext(sessionId: string) {
  return {
    sessionManager: {
      getCwd: () => root,
      getSessionId: () => sessionId,
      getSessionFile: () => undefined,
    },
  } as unknown as ExtensionToolContext
}

async function loadTools() {
  // This public Pi API loads the actual .ts modules using its jiti loader.
  const loaded = await discoverAndLoadExtensions(
    extensionPaths,
    root,
    join(root, "agent")
  )
  expect(loaded.errors).toEqual([])
  const definitions = loaded.extensions.flatMap((extension) =>
    [...extension.tools.values()].map((tool) => tool.definition)
  )
  const write = definitions.find((tool) => tool.name === "workspace_write")
  const install = definitions.find((tool) => tool.name === "resource_install")
  if (!write || !install) throw new Error("Harness tools were not loaded")
  return { write, install }
}

const writeParams = {
  path: "agent-workspace/scratch/note.md",
  content: "private",
}
const installParams = {
  kind: "prompt",
  name: "private",
  sourceType: "content",
  source: "Private prompt",
}

describe("Harness writes through Pi's filesystem extension loader", () => {
  it("uses the server resolver for each user's sandbox without host writes", async () => {
    const sandboxA = { id: "sandbox-a" }
    const sandboxB = { id: "sandbox-b" }
    mocks.getCachedUserSandbox.mockImplementation((userId) => ({
      sandbox: userId === "a" ? sandboxA : sandboxB,
    }))
    trackDaytonaToolSession("session-a", undefined, "a")
    trackDaytonaToolSession("session-b", undefined, "b")
    installHarnessWriteResolver()
    const { write, install } = await loadTools()

    const [a, b] = await Promise.all([
      write.execute(
        "write-a",
        writeParams,
        undefined,
        undefined,
        toolContext("session-a")
      ),
      write.execute(
        "write-b",
        { ...writeParams, content: "b's private note" },
        undefined,
        undefined,
        toolContext("session-b")
      ),
    ])
    expect(a.isError).not.toBe(true)
    expect(b.isError).not.toBe(true)
    expect(mocks.uploadFile).toHaveBeenCalledWith(
      sandboxA,
      "private",
      "/home/daytona/agent-workspace/scratch/note.md"
    )
    expect(mocks.uploadFile).toHaveBeenCalledWith(
      sandboxB,
      "b's private note",
      "/home/daytona/agent-workspace/scratch/note.md"
    )

    const installed = await install.execute(
      "install-a",
      installParams,
      undefined,
      undefined,
      toolContext("session-a")
    )
    expect(installed.isError).not.toBe(true)
    expect(mocks.uploadFile).toHaveBeenCalledWith(
      sandboxA,
      Buffer.from("Private prompt\n"),
      "/home/daytona/agent-workspace/pi/prompts/private.md"
    )
    expect(mocks.persistHarnessInstallSettings).toHaveBeenCalledWith({
      userId: "a",
      cwd: root,
      settings: expect.objectContaining({
        prompts: ["../agent-workspace/pi/prompts"],
      }),
    })
    expect(await readdir(root)).toEqual([])
  })

  it.each(["missing resolver", "unavailable sandbox"])(
    "fails closed with %s",
    async (condition) => {
      if (condition === "missing resolver") requireHarnessWriteResolver()
      else installHarnessWriteResolver()
      const { write, install } = await loadTools()
      for (const [tool, params] of [
        [write, writeParams],
        [install, installParams],
      ] as const) {
        const result = await tool.execute(
          "unavailable",
          params,
          undefined,
          undefined,
          toolContext("session-a")
        )
        expect(result.isError).toBe(true)
        expect(result.content).toEqual([
          expect.objectContaining({
            text: expect.stringContaining("Daytona sandbox"),
          }),
        ])
      }
      expect(mocks.uploadFile).not.toHaveBeenCalled()
      expect(await readdir(root)).toEqual([])
    }
  )

  it("keeps standalone local CLI host writes", async () => {
    vi.stubEnv("FLEET_PI_DEPLOYMENT", "")
    await mkdir(join(root, "agent-workspace/scratch"), { recursive: true })
    const { write, install } = await loadTools()
    await write.execute(
      "local-write",
      writeParams,
      undefined,
      undefined,
      toolContext("local")
    )
    await install.execute(
      "local-install",
      installParams,
      undefined,
      undefined,
      toolContext("local")
    )
    expect(
      await readFile(join(root, "agent-workspace/scratch/note.md"), "utf8")
    ).toBe("private")
    expect(
      await readFile(
        join(root, "agent-workspace/pi/prompts/private.md"),
        "utf8"
      )
    ).toBe("Private prompt\n")
    expect(mocks.uploadFile).not.toHaveBeenCalled()
  })
})
