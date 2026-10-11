import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  createAgentSession,
} from "@earendil-works/pi-coding-agent"
import {
  createFauxCore,
  fauxAssistantMessage,
  getCurrentSystemPrompt,
} from "@earendil-works/pi-ai"
import { ChatStreamEventSchema } from "@workspace/pi-protocol/chat-protocol.zod"
import { FLEET_PI_IDENTITY } from "../../../../../../.pi/extensions/lib/fleet-pi-identity"
import workspaceContextExtension from "../../../../../../.pi/extensions/workspace-context"
import {
  FLEET_PI_NO_TOOLS_NOTICE,
  buildFleetPiInlineExtensions,
  createFleetPiCoreExtension,
  resolveChatWorkspaceStatus,
  withoutWorkspaceTools,
} from "../runtime/fleet-pi-core-extensions"
import { applyChatStreamEvent } from "../chat-stream-state"
import { DAYTONA_CREDENTIAL_REQUIRED_MESSAGE } from "../chat-fetch"
import type { InlineExtension } from "@earendil-works/pi-coding-agent"
import type { Context } from "@earendil-works/pi-ai"

async function runPrompt(
  extensionFactories: Array<InlineExtension>,
  tools: Array<string> = ["read", "bash"]
) {
  const cwd = mkdtempSync(join(tmpdir(), "fleet-pi-core-"))
  const agentDir = join(cwd, "agent")
  let systemPrompt = ""
  const faux = createFauxCore({
    api: "faux",
    provider: "faux",
    models: [{ id: "m" }],
  })
  faux.setResponses([
    (context: Context) => {
      systemPrompt = getCurrentSystemPrompt(context.messages)
      return fauxAssistantMessage("ok")
    },
  ])
  const modelRuntime = await ModelRuntime.create({
    authPath: join(cwd, "auth.json"),
    modelsPath: null,
  })
  modelRuntime.registerProvider("faux", {
    api: "faux",
    apiKey: "test",
    baseUrl: "http://faux.invalid",
    streamSimple: faux.streamSimple,
    models: [
      {
        id: "m",
        name: "m",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 100_000,
        maxTokens: 1_000,
      },
    ],
  })
  const settingsManager = SettingsManager.inMemory({})
  // noExtensions: no `.pi/extensions` discovery, as on the Worker bundle.
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    extensionFactories,
  })
  await resourceLoader.reload()
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    model: modelRuntime.getModel("faux", "m"),
    modelRuntime,
    resourceLoader,
    settingsManager,
    sessionManager: SessionManager.inMemory(cwd),
    tools,
  })
  const allTools = session.getAllTools().map((tool) => tool.name)
  try {
    await session.prompt("What can you do?")
  } finally {
    session.dispose()
  }
  return { systemPrompt, allTools }
}

const count = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1

describe("server-side Fleet Pi core extensions", () => {
  it("resolves workspace status from Daytona + hosting", () => {
    expect(
      resolveChatWorkspaceStatus({
        daytonaEnabled: true,
        hostedDeployment: true,
      })
    ).toEqual({ toolsAvailable: true })
    expect(
      resolveChatWorkspaceStatus({
        daytonaEnabled: false,
        hostedDeployment: false,
      })
    ).toEqual({ toolsAvailable: true })
    expect(
      resolveChatWorkspaceStatus({
        daytonaEnabled: false,
        hostedDeployment: true,
      })
    ).toEqual({ toolsAvailable: false, reason: "daytona_credential_required" })
  })

  it("bundles workspace-free extensions only when .pi/extensions is not discoverable", () => {
    const names = (hasProjectExtensions: boolean) =>
      buildFleetPiInlineExtensions({
        projectRoot: "/nowhere",
        workspace: { toolsAvailable: true },
        hasProjectExtensions,
      }).map((extension) =>
        typeof extension === "function" ? "fn" : extension.name
      )
    expect(names(true)).toEqual(["fleet-pi-core"])
    expect(names(false)).toEqual([
      "fleet-pi-core",
      "bedrock-bearer-auth",
      "daytona-sandbox",
      "trust-handler",
      "web-fetch",
    ])
  })

  it("injects the identity when .pi extensions fail to load (Worker path)", async () => {
    const { systemPrompt, allTools } = await runPrompt(
      buildFleetPiInlineExtensions({
        projectRoot: "/nowhere",
        workspace: { toolsAvailable: true },
        hasProjectExtensions: false,
      }),
      ["read", "bash", "web_fetch"]
    )
    expect(count(systemPrompt, "<fleet_pi>")).toBe(1)
    expect(systemPrompt).toContain(FLEET_PI_IDENTITY)
    expect(systemPrompt).not.toContain(FLEET_PI_NO_TOOLS_NOTICE)
    // Workspace-free extensions still register their tools.
    expect(allTools).toContain("web_fetch")
  })

  it("does not duplicate the identity when workspace-context also loads", async () => {
    const { systemPrompt } = await runPrompt([
      createFleetPiCoreExtension({ toolsAvailable: true }),
      { name: "workspace-context", factory: workspaceContextExtension },
    ])
    expect(count(systemPrompt, "<fleet_pi>")).toBe(1)
    expect(systemPrompt).toMatch(/<tools>[\s\S]*- read:/)
  })

  it("tells the model it has no tools without a Daytona key", async () => {
    const { systemPrompt } = await runPrompt(
      [
        createFleetPiCoreExtension({
          toolsAvailable: false,
          reason: "daytona_credential_required",
        }),
      ],
      withoutWorkspaceTools(["read", "bash", "questionnaire"])
    )
    expect(systemPrompt).toContain(FLEET_PI_NO_TOOLS_NOTICE)
    expect(systemPrompt).toContain(FLEET_PI_IDENTITY)
    expect(systemPrompt).not.toMatch(/- read:/)
    expect(systemPrompt).not.toMatch(/- bash:/)
  })

  it("filters workspace tools from an active tool list", () => {
    expect(
      withoutWorkspaceTools([
        "read",
        "bash",
        "edit",
        "questionnaire",
        "web_fetch",
      ])
    ).toEqual(["questionnaire", "web_fetch"])
  })
})

describe("start event workspace flag", () => {
  const start = {
    type: "start" as const,
    id: "a1",
    runId: "a1",
    sessionId: "s1",
    diagnostics: ["Cannot initialize agent-workspace: permission denied."],
    workspace: {
      toolsAvailable: false as const,
      reason: "daytona_credential_required" as const,
    },
  }

  it("is valid against the protocol schema", () => {
    expect(ChatStreamEventSchema.safeParse(start).success).toBe(true)
    expect(
      ChatStreamEventSchema.safeParse({
        ...start,
        workspace: { toolsAvailable: true },
      }).success
    ).toBe(true)
  })

  it("drives the existing add-a-Daytona-key message", () => {
    const next = applyChatStreamEvent(
      {
        assistantId: undefined,
        snapshot: { messages: [], activityLabel: undefined } as never,
      } as never,
      start
    )
    expect(next.snapshot.activityLabel).toBe(
      DAYTONA_CREDENTIAL_REQUIRED_MESSAGE
    )
  })
})
