import { describe, expect, it } from "vitest"
import {
  ChatModeSchema,
  ChatSettingsResponseSchema,
  ChatSettingsUpdateRequestSchema,
} from "./chat-protocol.zod"
import type { ChatRequest } from "./chat-protocol"

describe("chat-protocol types", () => {
  it("accepts a valid agent mode request", () => {
    const req: ChatRequest = {
      message: "Hello",
      mode: "agent",
    }
    expect(req.mode).toBe("agent")
    expect(req.message).toBe("Hello")
  })

  it("accepts a valid plan mode request", () => {
    const req: ChatRequest = {
      message: "Plan this",
      mode: "plan",
      planAction: "execute",
    }
    expect(req.mode).toBe("plan")
    expect(req.planAction).toBe("execute")
  })

  it("accepts a valid harness mode request", () => {
    const req: ChatRequest = {
      message: "Manage the workspace architecture",
      mode: "harness",
    }

    expect(ChatModeSchema.parse(req.mode)).toBe("harness")
  })

  it("accepts session metadata", () => {
    const req: ChatRequest = {
      sessionFile: "/tmp/session.json",
      sessionId: "abc-123",
    }
    expect(req.sessionFile).toBe("/tmp/session.json")
    expect(req.sessionId).toBe("abc-123")
  })

  it("accepts valid project-scoped Pi settings responses", () => {
    const parsed = ChatSettingsResponseSchema.parse({
      diagnostics: [],
      effective: {
        compaction: {
          enabled: true,
          reserveTokens: 16384,
          keepRecentTokens: 20000,
        },
        defaultProvider: "amazon-bedrock",
        defaultModel: "us.anthropic.claude-sonnet-4-6",
        defaultThinkingLevel: "high",
        enableSkillCommands: true,
        enabledModels: ["claude-*"],
        extensions: ["extensions/resource-install"],
        followUpMode: "one-at-a-time",
        packages: ["npm:pi-autocontext"],
        prompts: ["../agent-workspace/pi/prompts"],
        retry: { enabled: true, maxRetries: 3, baseDelayMs: 2000 },
        skills: ["../agent-workspace/pi/skills"],
        steeringMode: "one-at-a-time",
        themes: [],
        transport: "auto",
      },
      project: {
        defaultThinkingLevel: "high",
        packages: [{ source: "npm:team-pack", skills: [] }],
      },
      projectPath: ".pi/settings.json",
      updateImpact: {
        newSessionRecommended: true,
        resourceReloadRequired: true,
      },
    })

    expect(parsed.effective.defaultThinkingLevel).toBe("high")
  })

  it("rejects invalid Pi settings updates", () => {
    expect(() =>
      ChatSettingsUpdateRequestSchema.parse({
        settings: {
          defaultThinkingLevel: "maximum",
        },
      })
    ).toThrow()

    expect(() =>
      ChatSettingsUpdateRequestSchema.parse({
        settings: {
          compaction: { reserveTokens: -1 },
        },
      })
    ).toThrow()

    expect(() =>
      ChatSettingsUpdateRequestSchema.parse({
        settings: {
          extensions: [""],
        },
      })
    ).toThrow()
  })
})
