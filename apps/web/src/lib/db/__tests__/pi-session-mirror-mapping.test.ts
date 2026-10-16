import { afterEach, describe, expect, it, vi } from "vitest"
import {
  extractPiSessionMirrorInput,
  mapSessionEntryToMirrorRow,
} from "../pi-session-mirror"
import { entryBase, header } from "./pi-session-mirror-fixtures"
import type { SessionEntry } from "@earendil-works/pi-coding-agent"

const originalChatDatabaseUrl = process.env.FLEET_PI_CHAT_DATABASE_URL

afterEach(() => {
  process.env.FLEET_PI_CHAT_DATABASE_URL = originalChatDatabaseUrl
  vi.restoreAllMocks()
})

describe("Pi session mirror mapping", () => {
  it("normalizes all Pi session entry families for Postgres indexing", () => {
    const entries = [
      {
        ...entryBase("message", "user-1"),
        type: "message",
        message: {
          role: "user",
          content: "hello fleet",
          timestamp: Date.now(),
        },
      },
      {
        ...entryBase("message", "assistant-1"),
        type: "message",
        parentId: "user-1",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "checking" },
            { type: "text", text: "done" },
            { type: "toolCall", id: "tool-1", name: "Read", arguments: {} },
          ],
          provider: "amazon-bedrock",
          model: "claude",
          usage: {
            totalTokens: 42,
            cost: { total: 0.12 },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        },
      },
      {
        ...entryBase("message", "tool-1"),
        type: "message",
        parentId: "assistant-1",
        message: {
          role: "toolResult",
          toolCallId: "tool-1",
          toolName: "Read",
          content: [{ type: "text", text: "package.json" }],
          isError: true,
          timestamp: Date.now(),
        },
      },
      {
        ...entryBase("model_change", "model-1"),
        type: "model_change",
        provider: "amazon-bedrock",
        modelId: "sonnet",
      },
      {
        ...entryBase("thinking_level_change", "thinking-1"),
        type: "thinking_level_change",
        thinkingLevel: "high",
      },
      {
        ...entryBase("compaction", "compaction-1"),
        type: "compaction",
        summary: "older context",
        firstKeptEntryId: "assistant-1",
        tokensBefore: 1000,
      },
      {
        ...entryBase("branch_summary", "branch-1"),
        type: "branch_summary",
        fromId: "assistant-1",
        summary: "alternate path",
      },
      {
        ...entryBase("custom", "custom-1"),
        type: "custom",
        customType: "plan-mode",
        data: { todos: 2 },
      },
      {
        ...entryBase("custom_message", "custom-message-1"),
        type: "custom_message",
        customType: "extension-note",
        content: "visible extension context",
        display: true,
      },
      {
        ...entryBase("label", "label-1"),
        type: "label",
        targetId: "assistant-1",
        label: "checkpoint",
      },
      {
        ...entryBase("session_info", "info-1"),
        type: "session_info",
        name: "Schema design",
      },
      {
        ...entryBase("context_edit", "edit-omit-1"),
        type: "context_edit",
        targetId: "tool-1",
        replacement: null,
      },
      {
        ...entryBase("context_edit", "edit-replace-1"),
        type: "context_edit",
        targetId: "user-1",
        replacement: { content: [{ type: "text", text: "hello (edited)" }] },
      },
    ] as Array<SessionEntry>

    const rows = entries.map((entry) =>
      mapSessionEntryToMirrorRow(header, entry)
    )

    expect(rows).toEqual([
      expect.objectContaining({
        entryId: "user-1",
        role: "user",
        contentText: "hello fleet",
      }),
      expect.objectContaining({
        entryId: "assistant-1",
        role: "assistant",
        provider: "amazon-bedrock",
        modelId: "claude",
        contentText: "checking\ndone\ntool:Read",
        tokensTotal: 42,
        costTotal: 0.12,
      }),
      expect.objectContaining({
        entryId: "tool-1",
        role: "toolResult",
        isError: true,
      }),
      expect.objectContaining({
        entryId: "model-1",
        provider: "amazon-bedrock",
        modelId: "sonnet",
      }),
      expect.objectContaining({
        entryId: "thinking-1",
        thinkingLevel: "high",
      }),
      expect.objectContaining({
        entryId: "compaction-1",
        summary: "older context",
        tokensTotal: 1000,
      }),
      expect.objectContaining({
        entryId: "branch-1",
        fromEntryId: "assistant-1",
        summary: "alternate path",
      }),
      expect.objectContaining({
        entryId: "custom-1",
        customType: "plan-mode",
        contentText: '{"todos":2}',
      }),
      expect.objectContaining({
        entryId: "custom-message-1",
        customType: "extension-note",
        contentText: "visible extension context",
      }),
      expect.objectContaining({
        entryId: "label-1",
        targetEntryId: "assistant-1",
        contentText: "checkpoint",
      }),
      expect.objectContaining({
        entryId: "info-1",
        contentText: "Schema design",
      }),
      expect.objectContaining({
        entryId: "edit-omit-1",
        entryType: "context_edit",
        targetEntryId: "tool-1",
        contentText: "[omitted from context]",
        isError: false,
      }),
      expect.objectContaining({
        entryId: "edit-replace-1",
        entryType: "context_edit",
        targetEntryId: "user-1",
        contentText: "hello (edited)",
      }),
    ])
  })

  it("extracts session-level metadata from a SessionManager-like source", () => {
    const entries = [
      {
        ...entryBase("message", "user-1"),
        type: "message",
        message: {
          role: "user",
          content: "first prompt",
          timestamp: Date.now(),
        },
      },
    ] as Array<SessionEntry>

    const input = extractPiSessionMirrorInput({
      getHeader: () => header,
      getSessionFile: () => "/repo/.fleet/sessions/session.jsonl",
      getCwd: () => "/repo",
      getSessionName: () => "Named session",
      getLeafId: () => "user-1",
      getEntries: () => entries,
    } as never)

    expect(input).toEqual(
      expect.objectContaining({
        id: "session-1",
        sessionFilePath: "/repo/.fleet/sessions/session.jsonl",
        cwd: "/repo",
        version: 3,
        name: "Named session",
        firstMessagePreview: "first prompt",
        leafEntryId: "user-1",
        entryCount: 1,
        messageCount: 1,
      })
    )
  })
})
