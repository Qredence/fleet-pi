import { describe, expect, it } from "vitest"
import {
  collectCompletedResourceInstallToolCallIds,
  planResourceInstallRefresh,
} from "./resource-install-refresh"
import type { ChatMessage } from "@workspace/pi-protocol/chat-types"
import type { WorkspaceTreeResponse } from "@workspace/pi-protocol/chat-protocol"

describe("resource install refresh signals", () => {
  it("collects successful resource_install tool calls", () => {
    expect(
      collectCompletedResourceInstallToolCallIds([
        assistantMessage([
          {
            input: { kind: "prompt", name: "daily-brief" },
            output: {
              details: {
                activationStatus: "reload-required",
                installedPath: "agent-workspace/pi/prompts/daily-brief.md",
              },
            },
            state: "output-available",
            toolCallId: "tool-install-1",
            type: "tool-resource_install",
          },
        ]),
      ])
    ).toEqual(["tool-install-1"])
  })

  it("ignores errored or incomplete resource_install tool calls", () => {
    expect(
      collectCompletedResourceInstallToolCallIds([
        assistantMessage([
          {
            input: { kind: "prompt", name: "daily-brief" },
            output: {
              details: {
                activationStatus: "reload-required",
                installedPath: "agent-workspace/pi/prompts/daily-brief.md",
              },
            },
            state: "output-error",
            toolCallId: "tool-install-error",
            type: "tool-resource_install",
          },
          {
            input: { file_path: "README.md" },
            output: { content: "# Fleet Pi" },
            state: "output-available",
            toolCallId: "tool-read-1",
            type: "tool-Read",
          },
          {
            input: { kind: "skill", name: "frontend-helper" },
            state: "input-available",
            toolCallId: "tool-install-pending",
            type: "tool-resource_install",
          },
        ]),
      ])
    ).toEqual([])
  })
})

describe("planResourceInstallRefresh", () => {
  const installMessage = assistantMessage([
    {
      input: { kind: "prompt", name: "daily-brief" },
      output: {
        details: {
          activationStatus: "reload-required",
          installedPath: "agent-workspace/pi/prompts/daily-brief.md",
        },
      },
      state: "output-available",
      toolCallId: "tool-install-1",
      type: "tool-resource_install",
    },
  ])
  const workspaceTree = {
    root: "agent-workspace",
    nodes: [],
  } as unknown as WorkspaceTreeResponse

  it("returns null when there are no unhandled completed installs", () => {
    expect(
      planResourceInstallRefresh({
        handledToolCallIds: new Set(),
        messages: [assistantMessage([])],
        shouldLoadWorkspaceTree: true,
        workspaceTree,
      })
    ).toBeNull()
  })

  it("flags resources refresh and workspace refresh when the tree is loaded", () => {
    expect(
      planResourceInstallRefresh({
        handledToolCallIds: new Set(),
        messages: [installMessage],
        shouldLoadWorkspaceTree: false,
        workspaceTree,
      })
    ).toEqual({ shouldRefreshWorkspace: true, toolCallIds: ["tool-install-1"] })
  })

  it("refreshes the workspace when the panel is open even without a tree", () => {
    expect(
      planResourceInstallRefresh({
        handledToolCallIds: new Set(),
        messages: [installMessage],
        shouldLoadWorkspaceTree: true,
        workspaceTree: null,
      })
    ).toEqual({ shouldRefreshWorkspace: true, toolCallIds: ["tool-install-1"] })
  })

  it("skips the workspace refresh when the tree is absent and the panel closed", () => {
    expect(
      planResourceInstallRefresh({
        handledToolCallIds: new Set(),
        messages: [installMessage],
        shouldLoadWorkspaceTree: false,
        workspaceTree: null,
      })
    ).toEqual({
      shouldRefreshWorkspace: false,
      toolCallIds: ["tool-install-1"],
    })
  })

  it("dedupes tool calls already handled in this session", () => {
    expect(
      planResourceInstallRefresh({
        handledToolCallIds: new Set(["tool-install-1"]),
        messages: [installMessage],
        shouldLoadWorkspaceTree: true,
        workspaceTree,
      })
    ).toBeNull()
  })
})

function assistantMessage(parts: ChatMessage["parts"]): ChatMessage {
  return {
    id: "assistant-1",
    parts,
    role: "assistant",
  }
}
