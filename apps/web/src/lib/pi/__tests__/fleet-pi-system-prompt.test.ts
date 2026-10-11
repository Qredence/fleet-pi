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
import {
  FLEET_PI_IDENTITY,
  applyFleetPiIdentity,
} from "../../../../../../.pi/extensions/lib/fleet-pi-identity"
import workspaceContextExtension from "../../../../../../.pi/extensions/workspace-context"
import type { Context } from "@earendil-works/pi-ai"

describe("Fleet Pi identity prompt section", () => {
  it("describes the Fleet Pi web workspace, not Pi's terminal app", () => {
    expect(FLEET_PI_IDENTITY).toContain("Fleet Pi")
    expect(FLEET_PI_IDENTITY).toMatch(/browser-based coding-agent workspace/)
    expect(FLEET_PI_IDENTITY).toMatch(/Durable plans/)
    expect(FLEET_PI_IDENTITY).toMatch(/Durable memory/)
    expect(FLEET_PI_IDENTITY).toMatch(/Repo-scoped tools/)
    expect(FLEET_PI_IDENTITY).toMatch(/Daytona workspaces/)
    expect(FLEET_PI_IDENTITY).toMatch(/Do not describe Pi's terminal UI/)
  })

  it("adds a section without touching other prompt options", () => {
    const event = {
      systemPromptOptions: {
        cwd: "/repo",
        selectedTools: ["read"],
        sections: { other: "kept" },
      },
    }
    applyFleetPiIdentity(event as never)
    expect(event.systemPromptOptions).toEqual({
      cwd: "/repo",
      selectedTools: ["read"],
      sections: { other: "kept", fleet_pi: FLEET_PI_IDENTITY },
    })
    // Tolerates events without structured options.
    expect(() => applyFleetPiIdentity({} as never)).not.toThrow()
  })

  it("reaches the provider with Pi's tool guidance intact (real session)", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "fleet-pi-prompt-"))
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
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir,
      settingsManager,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
      extensionFactories: [
        { name: "workspace-context", factory: workspaceContextExtension },
      ],
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
      tools: ["read", "bash"],
    })
    try {
      await session.prompt("What can Fleet Pi do?")
    } finally {
      session.dispose()
    }

    expect(systemPrompt).toContain(
      `<fleet_pi>\n${FLEET_PI_IDENTITY}\n</fleet_pi>`
    )
    // Pi's own tool list and rules are still present.
    expect(systemPrompt).toMatch(/<tools>[\s\S]*- read:[\s\S]*- bash:/)
    expect(systemPrompt).toMatch(/<rules>[\s\S]*Be concise in your responses/)
  })
})
