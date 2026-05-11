import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createPathProvenanceResponse,
  createRunDetailResponse,
  createSessionRunsResponse,
} from "./provenance-query"
import { createRunProvenanceRecorder } from "./run-provenance"
import type { AppRuntimeContext } from "../app-runtime"

const SessionManager = {
  create: vi.fn(),
  list: vi.fn(),
  open: vi.fn(),
}

vi.mock("@earendil-works/pi-coding-agent", () => ({
  SessionManager,
}))

vi.mock("./server-shared", () => ({
  createSessionServices: vi.fn(() => ({
    settingsManager: {
      getSessionDir: () => ".fleet/sessions",
    },
  })),
  getSessionDir: vi.fn((repoRoot: string) =>
    resolve(repoRoot, ".fleet", "sessions")
  ),
  safeRealpath: vi.fn((path: string) => resolve(path)),
}))

const roots = new Set<string>()

beforeEach(() => {
  SessionManager.create.mockReset()
  SessionManager.list.mockReset()
  SessionManager.open.mockReset()
})

afterEach(() => {
  vi.resetModules()
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

function createProjectRoot(prefix = "fleet-pi-cross-surface-") {
  const root = mkdtempSync(join(tmpdir(), prefix))
  roots.add(root)
  return root
}

function createContext(projectRoot: string): AppRuntimeContext {
  return {
    projectRoot,
    workspaceRoot: join(projectRoot, "agent-workspace"),
  }
}

function writeProjectFile(
  projectRoot: string,
  relativePath: string,
  content: string
) {
  const absolutePath = join(projectRoot, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function createSessionFile(projectRoot: string, name: string) {
  const sessionFile = join(projectRoot, ".fleet", "sessions", name)
  writeProjectFile(projectRoot, `.fleet/sessions/${name}`, "")
  return sessionFile
}

function createSessionManagerStub(
  sessionFile: string,
  sessionId: string,
  entries: Array<Record<string, unknown>>
) {
  return {
    getBranch: () => entries,
    getEntries: () => entries,
    getSessionFile: () => sessionFile,
    getSessionId: () => sessionId,
  }
}

describe("cross-surface runtime hardening", () => {
  it("keeps resumed tool activity traceable to run detail and canonical paths", async () => {
    const projectRoot = createProjectRoot()
    const context = createContext(projectRoot)
    const sessionFile = createSessionFile(projectRoot, "session-1.jsonl")

    writeProjectFile(
      projectRoot,
      "agent-workspace/memory/project/preferences.md",
      "# Preferences\n\n- alpha\n"
    )

    const recorder = createRunProvenanceRecorder(context, {
      mode: "agent",
    })

    recorder.record({
      type: "start",
      id: "run-write-1",
      runId: "run-write-1",
      sessionFile,
      sessionId: "session-1",
    })
    recorder.record({
      type: "tool",
      part: {
        type: "tool-Write",
        toolCallId: "tool-write-1",
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

    recorder.record({
      type: "done",
      runId: "run-write-1",
      message: {
        id: "run-write-1",
        role: "assistant",
        parts: [{ type: "text", text: "Updated preferences to beta." }],
        createdAt: Date.now(),
      },
      sessionFile,
      sessionId: "session-1",
    })
    recorder.close()

    const sessionEntries: Array<Record<string, unknown>> = [
      {
        type: "message",
        id: "user-entry-1",
        message: {
          role: "user",
          timestamp: Date.now() - 1_000,
          content: [{ type: "text", text: "Update preferences" }],
        },
      },
      {
        type: "message",
        id: "assistant-entry-1",
        message: {
          role: "assistant",
          timestamp: Date.now(),
          content: [
            {
              type: "tool",
              id: "tool-write-1",
              name: "Write",
              arguments: {
                file_path: "agent-workspace/memory/project/preferences.md",
                content: "# Preferences\n\n- beta\n",
              },
            },
            {
              type: "text",
              text: "Updated preferences to beta.",
            },
          ],
        },
      },
      {
        type: "message",
        id: "tool-result-1",
        message: {
          role: "toolResult",
          timestamp: Date.now() + 1,
          toolCallId: "tool-write-1",
          toolName: "Write",
          isError: false,
          content: [{ type: "text", text: "Saved updated preferences." }],
        },
      },
      {
        type: "custom",
        customType: "chat-message-id",
        data: {
          sessionMessageId: "assistant-entry-1",
          chatMessageId: "chat-assistant-1",
        },
      },
    ]

    SessionManager.open.mockReturnValue(
      createSessionManagerStub(sessionFile, "session-1", sessionEntries)
    )

    const { hydrateChatSession } = await import("./server-sessions")
    const resumed = await hydrateChatSession(context, {
      sessionFile,
      sessionId: "session-1",
    })

    expect(resumed.session).toEqual({
      sessionFile,
      sessionId: "session-1",
    })
    const resumedAssistant = resumed.messages.find(
      (message) => message.role === "assistant"
    )
    expect(resumedAssistant).toMatchObject({
      id: "chat-assistant-1",
    })
    expect(resumedAssistant?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tool-Write",
          toolCallId: "tool-write-1",
        }),
        expect.objectContaining({
          type: "text",
          text: "Updated preferences to beta.",
        }),
      ])
    )

    const runDetail = createRunDetailResponse(context, "run-write-1")
    expect(runDetail.toolCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolCallId: "tool-write-1",
          toolName: "Write",
        }),
      ])
    )
    expect(runDetail.mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalPath: "agent-workspace/memory/project/preferences.md",
          toolCallId: "tool-write-1",
        }),
      ])
    )

    const pathProvenance = createPathProvenanceResponse(
      context,
      "agent-workspace/memory/project/preferences.md"
    )
    expect(pathProvenance.total).toBe(1)
    expect(pathProvenance.runs).toEqual([
      expect.objectContaining({
        run: expect.objectContaining({
          runId: "run-write-1",
          sessionId: "session-1",
        }),
        mutation: expect.objectContaining({
          canonicalPath: "agent-workspace/memory/project/preferences.md",
          toolCallId: "tool-write-1",
        }),
      }),
    ])
  })

  it("resets invalid session metadata without inheriting prior session provenance", async () => {
    const projectRoot = createProjectRoot("fleet-pi-cross-surface-reset-")
    const outsideRoot = createProjectRoot("fleet-pi-cross-surface-outside-")
    const context = createContext(projectRoot)
    const oldSessionFile = createSessionFile(projectRoot, "session-old.jsonl")
    const outsideSessionFile = createSessionFile(
      outsideRoot,
      "session-outside.jsonl"
    )
    const freshSessionFile = join(
      projectRoot,
      ".fleet",
      "sessions",
      "session-fresh.jsonl"
    )

    const recorder = createRunProvenanceRecorder(context, {
      mode: "agent",
    })
    recorder.record({
      type: "start",
      id: "run-old-1",
      runId: "run-old-1",
      sessionFile: oldSessionFile,
      sessionId: "session-old",
    })
    recorder.record({
      type: "done",
      runId: "run-old-1",
      message: {
        id: "run-old-1",
        role: "assistant",
        parts: [{ type: "text", text: "Previous session completed." }],
        createdAt: Date.now(),
      },
      sessionFile: oldSessionFile,
      sessionId: "session-old",
    })
    recorder.close()

    SessionManager.create.mockReturnValue(
      createSessionManagerStub(freshSessionFile, "session-fresh", [])
    )

    const { hydrateChatSession } = await import("./server-sessions")
    const resetResult = await hydrateChatSession(context, {
      sessionFile: outsideSessionFile,
      sessionId: "session-old",
    })

    expect(resetResult).toMatchObject({
      session: {
        sessionFile: freshSessionFile,
        sessionId: "session-fresh",
      },
      sessionReset: true,
    })
    expect(resetResult.messages).toEqual([])

    const freshRuns = createSessionRunsResponse(context, {
      sessionId: "session-fresh",
    })
    expect(freshRuns.total).toBe(0)

    const oldRuns = createSessionRunsResponse(context, {
      sessionId: "session-old",
    })
    expect(oldRuns.total).toBe(1)
    expect(oldRuns.runs).toEqual([
      expect.objectContaining({
        runId: "run-old-1",
      }),
    ])
    expect(SessionManager.open).not.toHaveBeenCalled()
  })
})
