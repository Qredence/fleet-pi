import * as NodeFS from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createRunProvenanceRecorder,
  mutationsFromToolResults,
} from "../run-provenance"
import { createRunDetailResponse } from "../provenance-query"
import type { AppRuntimeContext } from "../../app-runtime"
import type { WorkspaceFS } from "../../workspace/workspace-fs"

const MAX_HASH_FILE_SIZE = 4 * 1024 * 1024 // 4 MiB

const { readdirSyncSpy } = vi.hoisted(() => ({
  readdirSyncSpy: vi.fn(),
}))

// Wrap readdirSync so we can assert the filesystem walk is (or is not) invoked
// while still delegating to the real implementation for local walks.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFS>()
  return {
    ...actual,
    readdirSync: (...args: Parameters<typeof actual.readdirSync>) => {
      readdirSyncSpy(...args)
      return actual.readdirSync(...args)
    },
  }
})

const roots = new Set<string>()

afterEach(() => {
  for (const root of roots) {
    NodeFS.rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
  readdirSyncSpy.mockClear()
})

function createProjectRoot(prefix = "fleet-pi-provenance-scope-") {
  const root = NodeFS.mkdtempSync(join(tmpdir(), prefix))
  roots.add(root)
  return root
}

function createLocalContext(projectRoot: string): AppRuntimeContext {
  return {
    projectRoot,
    workspaceRoot: join(projectRoot, "agent-workspace"),
  }
}

function createDaytonaContext(projectRoot: string): AppRuntimeContext {
  return {
    projectRoot,
    workspaceRoot: join(projectRoot, "agent-workspace"),
    workspaceFS: {} as WorkspaceFS,
  }
}

function writeProjectFile(
  projectRoot: string,
  relativePath: string,
  content: string | Buffer
) {
  const absolutePath = join(projectRoot, relativePath)
  NodeFS.mkdirSync(dirname(absolutePath), { recursive: true })
  NodeFS.writeFileSync(absolutePath, content)
}

function createSessionFile(projectRoot: string, name: string) {
  const sessionFile = join(projectRoot, ".fleet", "sessions", name)
  writeProjectFile(projectRoot, `.fleet/sessions/${name}`, "")
  return sessionFile
}

function assistantDone(runId: string, sessionFile: string, sessionId: string) {
  return {
    type: "done" as const,
    runId,
    message: {
      id: runId,
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Finished." }],
      createdAt: Date.now(),
    },
    sessionFile,
    sessionId,
  }
}

describe("provenance snapshot scoping", () => {
  it("performs no filesystem walk for Daytona sessions", () => {
    const projectRoot = createProjectRoot()
    const context = createDaytonaContext(projectRoot)
    const sessionFile = createSessionFile(projectRoot, "session-1.jsonl")

    writeProjectFile(
      projectRoot,
      "agent-workspace/memory/project/preferences.md",
      "# Preferences\n\n- alpha\n"
    )
    writeProjectFile(projectRoot, "src/out-of-scope.ts", "export const x = 1\n")

    const recorder = createRunProvenanceRecorder(context, { mode: "agent" })
    recorder.record({
      type: "start",
      id: "run-1",
      runId: "run-1",
      sessionFile,
      sessionId: "session-1",
    })
    recorder.record({
      type: "tool",
      part: {
        type: "tool-workspace_write",
        toolCallId: "tool-1",
        state: "input-available",
        input: {
          file_path: "agent-workspace/memory/project/preferences.md",
          content: "# Preferences\n\n- beta\n",
        },
      },
    })
    writeProjectFile(
      projectRoot,
      "agent-workspace/memory/project/preferences.md",
      "# Preferences\n\n- beta\n"
    )
    recorder.record(assistantDone("run-1", sessionFile, "session-1"))
    recorder.close()

    expect(readdirSyncSpy).not.toHaveBeenCalled()

    const detail = createRunDetailResponse(context, "run-1")
    expect(detail.mutations).toEqual([])
  })

  it("scopes the local walk to agent-workspace, .pi, and claimed paths", () => {
    const projectRoot = createProjectRoot()
    const context = createLocalContext(projectRoot)
    const sessionFile = createSessionFile(projectRoot, "session-2.jsonl")

    // In-scope base root file.
    writeProjectFile(
      projectRoot,
      "agent-workspace/memory/project/notes.md",
      "# Notes\n\n- alpha\n"
    )
    // A claimed path outside the base roots (agent-workspace / .pi).
    writeProjectFile(projectRoot, "config/overrides.json", '{ "version": 1 }\n')
    // Out-of-scope file that is never claimed by any tool.
    writeProjectFile(projectRoot, "src/out-of-scope.ts", "export const x = 1\n")

    const recorder = createRunProvenanceRecorder(context, { mode: "agent" })
    recorder.record({
      type: "start",
      id: "run-2",
      runId: "run-2",
      sessionFile,
      sessionId: "session-2",
    })

    recorder.record({
      type: "tool",
      part: {
        type: "tool-workspace_write",
        toolCallId: "tool-2a",
        state: "input-available",
        input: {
          file_path: "agent-workspace/memory/project/notes.md",
          content: "# Notes\n\n- beta\n",
        },
      },
    })
    writeProjectFile(
      projectRoot,
      "agent-workspace/memory/project/notes.md",
      "# Notes\n\n- beta\n"
    )

    recorder.record({
      type: "tool",
      part: {
        type: "tool-workspace_write",
        toolCallId: "tool-2b",
        state: "input-available",
        input: {
          file_path: "config/overrides.json",
          content: '{ "version": 2 }\n',
        },
      },
    })
    writeProjectFile(projectRoot, "config/overrides.json", '{ "version": 2 }\n')

    // Out-of-scope mutation that no tool claimed.
    writeProjectFile(projectRoot, "src/out-of-scope.ts", "export const x = 2\n")

    recorder.record(assistantDone("run-2", sessionFile, "session-2"))
    recorder.close()

    const detail = createRunDetailResponse(context, "run-2")
    const paths = detail.mutations.map((mutation) => mutation.canonicalPath)

    expect(paths).toContain("agent-workspace/memory/project/notes.md")
    expect(paths).toContain("config/overrides.json")
    expect(paths).not.toContain("src/out-of-scope.ts")
  })

  it("retains the 4 MiB file-size cap for local snapshots", () => {
    const projectRoot = createProjectRoot()
    const context = createLocalContext(projectRoot)
    const sessionFile = createSessionFile(projectRoot, "session-3.jsonl")

    writeProjectFile(
      projectRoot,
      "agent-workspace/small.md",
      "# Small\n\n- alpha\n"
    )
    writeProjectBuffer(
      projectRoot,
      "agent-workspace/big.bin",
      Buffer.alloc(MAX_HASH_FILE_SIZE + 1, 0x61)
    )

    const recorder = createRunProvenanceRecorder(context, { mode: "agent" })
    recorder.record({
      type: "start",
      id: "run-3",
      runId: "run-3",
      sessionFile,
      sessionId: "session-3",
    })
    recorder.record({
      type: "tool",
      part: {
        type: "tool-bash",
        toolCallId: "tool-3",
        state: "input-available",
        input: { command: "true" },
      },
    })
    writeProjectFile(
      projectRoot,
      "agent-workspace/small.md",
      "# Small\n\n- beta\n"
    )
    writeProjectBuffer(
      projectRoot,
      "agent-workspace/big.bin",
      Buffer.alloc(MAX_HASH_FILE_SIZE + 1, 0x62)
    )
    recorder.record(assistantDone("run-3", sessionFile, "session-3"))
    recorder.close()

    const detail = createRunDetailResponse(context, "run-3")
    const paths = detail.mutations.map((mutation) => mutation.canonicalPath)

    expect(paths).toContain("agent-workspace/small.md")
    expect(paths).not.toContain("agent-workspace/big.bin")
  })
})

function writeProjectBuffer(
  projectRoot: string,
  relativePath: string,
  content: Buffer
) {
  writeProjectFile(projectRoot, relativePath, content)
}

describe("Daytona mutations from edit/write tool results", () => {
  function tool(
    name: string,
    toolCallId: string,
    state: "input-available" | "output-available" | "output-error",
    path: string
  ) {
    return {
      type: "tool" as const,
      part: {
        type: `tool-${name}` as const,
        toolCallId,
        state,
        input: { path },
        ...(state === "output-available" && {
          output: { content: [{ type: "text", text: "ok" }] },
        }),
        ...(state === "output-error" && { errorText: "failed" }),
      },
    }
  }

  it("records path and kind for successful edit/write calls without a filesystem walk", () => {
    const projectRoot = createProjectRoot()
    const context = createDaytonaContext(projectRoot)
    const sessionFile = createSessionFile(projectRoot, "session-d.jsonl")
    const recorder = createRunProvenanceRecorder(context, { mode: "agent" })
    recorder.record({
      type: "start",
      id: "run-d",
      runId: "run-d",
      sessionFile,
      sessionId: "session-d",
    })
    recorder.record(tool("edit", "t-edit", "input-available", "src/app.ts"))
    recorder.record(tool("edit", "t-edit", "output-available", "src/app.ts"))
    recorder.record(tool("write", "t-write", "input-available", "src/new.ts"))
    recorder.record(tool("write", "t-write", "output-available", "src/new.ts"))
    recorder.record(tool("edit", "t-fail", "output-error", "src/broken.ts"))
    recorder.record(tool("read", "t-read", "output-available", "src/read.ts"))
    recorder.record(assistantDone("run-d", sessionFile, "session-d"))
    recorder.close()

    expect(readdirSyncSpy).not.toHaveBeenCalled()
    const detail = createRunDetailResponse(context, "run-d")
    expect(
      detail.mutations.map((m) => ({
        path: m.canonicalPath,
        kind: m.kind,
        toolCallId: m.toolCallId,
      }))
    ).toEqual([
      { path: "src/app.ts", kind: "updated", toolCallId: "t-edit" },
      { path: "src/new.ts", kind: "created", toolCallId: "t-write" },
    ])
    expect(detail.run.mutationCount).toBe(2)
  })
})

describe("mutationsFromToolResults", () => {
  const call = (
    toolName: string,
    toolCallId: string,
    lastSequence: number,
    overrides: Partial<{ state: string; isError: boolean }> = {}
  ) => ({
    toolCallId,
    toolName,
    state: "output-available",
    isError: false,
    claimedPaths: ["agent-workspace/notes.md"],
    lastSequence,
    ...overrides,
  })

  it("keeps the first kind, last attribution, and skips failures", () => {
    expect(
      mutationsFromToolResults([
        call("edit", "a", 3),
        call("write", "b", 7),
        call("write", "c", 9, { isError: true }),
        call("write", "d", 11, { state: "input-available" }),
      ])
    ).toEqual([
      {
        canonicalPath: "agent-workspace/notes.md",
        kind: "updated",
        toolCallId: "b",
        eventSequence: 7,
        summary: "Edited agent-workspace/notes.md via write (Daytona)",
      },
    ])
  })
})
