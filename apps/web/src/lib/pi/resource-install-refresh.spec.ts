import { describe, expect, it } from "vitest"
import { collectCompletedResourceInstallToolCallIds } from "./resource-install-refresh"
import type { ChatMessage } from "@workspace/ui/components/agent-elements/chat-types"

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

function assistantMessage(parts: ChatMessage["parts"]): ChatMessage {
  return {
    id: "assistant-1",
    parts,
    role: "assistant",
  }
}
