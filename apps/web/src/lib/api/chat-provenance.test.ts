import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { resolveAppRuntimeContext } from "../app-runtime"
import { createRunProvenanceRecorder } from "../pi/run-provenance"
import { chatProvenanceHandler } from "../../routes/api/chat/provenance"
import { chatRunHandler } from "../../routes/api/chat/run"
import { chatRunsHandler } from "../../routes/api/chat/runs"

const roots = new Set<string>()
const originalRepoRoot = process.env.FLEET_PI_REPO_ROOT

beforeEach(() => {
  delete process.env.FLEET_PI_REPO_ROOT
})

afterEach(() => {
  process.env.FLEET_PI_REPO_ROOT = originalRepoRoot
  for (const root of roots) {
    rmSync(root, { force: true, recursive: true })
  }
  roots.clear()
})

function createProjectRoot() {
  const root = mkdtempSync(join(tmpdir(), "fleet-pi-chat-provenance-"))
  roots.add(root)
  process.env.FLEET_PI_REPO_ROOT = root
  return root
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

function createRequest(path: string) {
  return new Request(`http://localhost:3000${path}`)
}

describe("chat provenance APIs", () => {
  it("lists session runs, preserves ordered event history, and resolves canonical file mutations", async () => {
    const projectRoot = createProjectRoot()
    const sessionFile = createSessionFile(projectRoot, "session-1.jsonl")

    writeProjectFile(
      projectRoot,
      "agent-workspace/memory/project/preferences.md",
      "# Preferences\n\n- alpha\n"
    )

    const recorder = createRunProvenanceRecorder(resolveAppRuntimeContext(), {
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
        type: "tool-workspace_write",
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

    const runsResponse = await chatRunsHandler(
      createRequest("/api/chat/runs?sessionId=session-1")
    )
    const runsBody = (await runsResponse.json()) as {
      total: number
      runs: Array<{
        runId: string
        assistantMessageId: string
        mutationCount: number
        sessionTurnIndex: number
      }>
    }

    expect(runsResponse.status).toBe(200)
    expect(runsBody.total).toBe(1)
    expect(runsBody.runs).toEqual([
      expect.objectContaining({
        runId: "run-write-1",
        assistantMessageId: "run-write-1",
        mutationCount: 1,
        sessionTurnIndex: 1,
      }),
    ])

    const detailResponse = await chatRunHandler(
      createRequest("/api/chat/run?id=run-write-1")
    )
    const detailBody = (await detailResponse.json()) as {
      events: Array<{ sequence: number; eventType: string }>
      toolCalls: Array<{
        toolCallId: string
        toolName: string
        firstSequence: number
        lastSequence: number
      }>
      mutations: Array<{
        canonicalPath: string
        toolCallId: string
        summary: string
      }>
    }

    expect(detailResponse.status).toBe(200)
    expect(detailBody.events.map((event) => event.sequence)).toEqual([1, 2, 3])
    expect(detailBody.events.map((event) => event.eventType)).toEqual([
      "start",
      "tool",
      "done",
    ])
    expect(detailBody.toolCalls).toEqual([
      expect.objectContaining({
        toolCallId: "tool-write-1",
        toolName: "workspace_write",
      }),
    ])
    expect(detailBody.mutations).toEqual([
      expect.objectContaining({
        canonicalPath: "agent-workspace/memory/project/preferences.md",
        toolCallId: "tool-write-1",
      }),
    ])

    const pathResponse = await chatProvenanceHandler(
      createRequest(
        "/api/chat/provenance?path=agent-workspace/memory/project/preferences.md"
      )
    )
    const pathBody = (await pathResponse.json()) as {
      canonicalPath: string
      total: number
      runs: Array<{
        run: { runId: string }
        mutation: { toolName: string | null }
      }>
    }

    expect(pathResponse.status).toBe(200)
    expect(pathBody.canonicalPath).toBe(
      "agent-workspace/memory/project/preferences.md"
    )
    expect(pathBody.total).toBe(1)
    expect(pathBody.runs).toEqual([
      expect.objectContaining({
        run: expect.objectContaining({ runId: "run-write-1" }),
        mutation: expect.objectContaining({ toolName: "workspace_write" }),
      }),
    ])
  })

  it("attributes workspace resource installs and compatibility bridge updates to the installing run", async () => {
    const projectRoot = createProjectRoot()
    const sessionFile = createSessionFile(projectRoot, "session-2.jsonl")
    const recorder = createRunProvenanceRecorder(resolveAppRuntimeContext(), {
      mode: "agent",
    })

    recorder.record({
      type: "start",
      id: "run-install-1",
      runId: "run-install-1",
      sessionFile,
      sessionId: "session-2",
    })
    recorder.record({
      type: "tool",
      part: {
        type: "tool-resource_install",
        toolCallId: "tool-install-1",
        state: "input-available",
        input: {
          kind: "skill",
          name: "demo-skill",
        },
        output: {
          details: {
            installedPath: "agent-workspace/pi/skills/demo-skill/SKILL.md",
            settingsUpdated: true,
          },
        },
      },
    })

    writeProjectFile(
      projectRoot,
      "agent-workspace/pi/skills/demo-skill/SKILL.md",
      "# Demo skill\n"
    )
    writeProjectFile(
      projectRoot,
      ".pi/settings.json",
      '{\n  "skills": ["../agent-workspace/pi/skills"]\n}\n'
    )

    recorder.record({
      type: "done",
      runId: "run-install-1",
      message: {
        id: "run-install-1",
        role: "assistant",
        parts: [{ type: "text", text: "Installed demo skill." }],
        createdAt: Date.now(),
      },
      sessionFile,
      sessionId: "session-2",
    })
    recorder.close()

    const detailResponse = await chatRunHandler(
      createRequest("/api/chat/run?id=run-install-1")
    )
    const detailBody = (await detailResponse.json()) as {
      mutations: Array<{
        canonicalPath: string
        toolCallId: string | null
      }>
    }

    expect(detailResponse.status).toBe(200)
    expect(detailBody.mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalPath: "agent-workspace/pi/skills/demo-skill/SKILL.md",
          toolCallId: "tool-install-1",
        }),
        expect.objectContaining({
          canonicalPath: ".pi/settings.json",
          toolCallId: "tool-install-1",
        }),
      ])
    )

    const provenanceResponse = await chatProvenanceHandler(
      createRequest("/api/chat/provenance?path=.pi/settings.json")
    )
    const provenanceBody = (await provenanceResponse.json()) as {
      total: number
      runs: Array<{
        run: { runId: string }
        mutation: { toolName: string | null }
      }>
    }

    expect(provenanceResponse.status).toBe(200)
    expect(provenanceBody.total).toBe(1)
    expect(provenanceBody.runs).toEqual([
      expect.objectContaining({
        run: expect.objectContaining({ runId: "run-install-1" }),
        mutation: expect.objectContaining({ toolName: "resource_install" }),
      }),
    ])
  })

  it("returns explicit empty mutations for read-only turns and links plan-driven runs back to the prior plan run", async () => {
    const projectRoot = createProjectRoot()
    const sessionFile = createSessionFile(projectRoot, "session-3.jsonl")

    const planRecorder = createRunProvenanceRecorder(
      resolveAppRuntimeContext(),
      {
        mode: "plan",
      }
    )
    planRecorder.record({
      type: "start",
      id: "run-plan-1",
      runId: "run-plan-1",
      sessionFile,
      sessionId: "session-3",
    })
    planRecorder.record({
      type: "done",
      runId: "run-plan-1",
      message: {
        id: "run-plan-1",
        role: "assistant",
        parts: [{ type: "text", text: "Plan:\n1. Update notes" }],
        createdAt: Date.now(),
      },
      sessionFile,
      sessionId: "session-3",
    })
    planRecorder.close()

    writeProjectFile(
      projectRoot,
      "agent-workspace/memory/project/notes.md",
      "# Notes\n\n- alpha\n"
    )

    const executeRecorder = createRunProvenanceRecorder(
      resolveAppRuntimeContext(),
      {
        mode: "agent",
        planAction: "execute",
      }
    )
    executeRecorder.record({
      type: "start",
      id: "run-execute-1",
      runId: "run-execute-1",
      sessionFile,
      sessionId: "session-3",
    })
    executeRecorder.record({
      type: "tool",
      part: {
        type: "tool-Edit",
        toolCallId: "tool-edit-1",
        state: "input-available",
        input: {
          file_path: "agent-workspace/memory/project/notes.md",
          old_string: "# Notes\n\n- alpha\n",
          new_string: "# Notes\n\n- beta\n",
        },
      },
    })

    writeProjectFile(
      projectRoot,
      "agent-workspace/memory/project/notes.md",
      "# Notes\n\n- beta\n"
    )

    executeRecorder.record({
      type: "done",
      runId: "run-execute-1",
      message: {
        id: "run-execute-1",
        role: "assistant",
        parts: [{ type: "text", text: "Executed the plan and updated notes." }],
        createdAt: Date.now(),
      },
      sessionFile,
      sessionId: "session-3",
    })
    executeRecorder.close()

    const planDetailResponse = await chatRunHandler(
      createRequest("/api/chat/run?id=run-plan-1")
    )
    const planDetailBody = (await planDetailResponse.json()) as {
      mutations: Array<unknown>
    }

    expect(planDetailResponse.status).toBe(200)
    expect(planDetailBody.mutations).toEqual([])

    const executeDetailResponse = await chatRunHandler(
      createRequest("/api/chat/run?id=run-execute-1")
    )
    const executeDetailBody = (await executeDetailResponse.json()) as {
      linkedPlanRunId: string | null
      run: { planAction: string | null }
      mutations: Array<{ canonicalPath: string }>
    }

    expect(executeDetailResponse.status).toBe(200)
    expect(executeDetailBody.linkedPlanRunId).toBe("run-plan-1")
    expect(executeDetailBody.run.planAction).toBe("execute")
    expect(executeDetailBody.mutations).toEqual([
      expect.objectContaining({
        canonicalPath: "agent-workspace/memory/project/notes.md",
      }),
    ])

    const runsResponse = await chatRunsHandler(
      createRequest("/api/chat/runs?sessionId=session-3")
    )
    const runsBody = (await runsResponse.json()) as {
      runs: Array<{ runId: string; sessionTurnIndex: number }>
    }

    expect(runsResponse.status).toBe(200)
    expect(runsBody.runs).toEqual([
      expect.objectContaining({ runId: "run-plan-1", sessionTurnIndex: 1 }),
      expect.objectContaining({
        runId: "run-execute-1",
        sessionTurnIndex: 2,
      }),
    ])
  })
})
