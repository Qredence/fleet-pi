import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  applyModelSelection,
  loadChatModels,
  loadChatResources,
  resolveModelSelection,
} from "../runtime"

const mocks = vi.hoisted(() => ({
  applyWorkspaceResourceMetadata: vi.fn(
    (_projectRoot: string, _settings: unknown, resource: unknown) => resource
  ),
  collectDiagnostics: vi.fn(() => ["runtime diagnostic"]),
  collectResourceExpectationDiagnostics: vi.fn(() => [
    "resource expectation diagnostic",
  ]),
  createSessionServices: vi.fn(),
  loadWorkspaceResourceOverlay: vi.fn(() => ({
    packages: [{ name: "pi-web-access", path: "agent-workspace/pi/packages" }],
    skills: [],
    prompts: [],
    extensions: [],
  })),
  mergeResourceInfo: vi.fn(
    (
      _projectRoot: string,
      runtimeResources: Array<unknown>,
      workspaceResources
    ) => [...runtimeResources, ...workspaceResources]
  ),
  readWorkspacePiSettings: vi.fn(() => ({ packages: ["npm:pi-web-access"] })),
  resolveDefaultModelSelection: vi.fn(() => ({
    defaultProvider: "google",
    defaultModel: "gemini-3.5-flash",
  })),
}))

vi.mock("../resource-expectations", () => ({
  collectResourceExpectationDiagnostics:
    mocks.collectResourceExpectationDiagnostics,
}))

vi.mock("../runtime/session-factory", () => ({
  createSessionServices: mocks.createSessionServices,
}))

vi.mock("../runtime/diagnostics", () => ({
  collectDiagnostics: mocks.collectDiagnostics,
  resolveDefaultModelSelection: mocks.resolveDefaultModelSelection,
}))

vi.mock("../workspace-resource-catalog", () => ({
  applyWorkspaceResourceMetadata: mocks.applyWorkspaceResourceMetadata,
  loadWorkspaceResourceOverlay: mocks.loadWorkspaceResourceOverlay,
  mergeResourceInfo: mocks.mergeResourceInfo,
  readWorkspacePiSettings: mocks.readWorkspacePiSettings,
}))

function createModel(provider: string, id: string, extra = {}) {
  return {
    provider,
    id,
    name: `${provider} ${id}`,
    input: ["text"],
    reasoning: false,
    ...extra,
  }
}

type FakeModel = ReturnType<typeof createModel>

function createServices({
  all,
  available = all,
  defaultThinkingLevel = "medium",
  enabledModels,
}: {
  all?: Array<FakeModel>
  available?: Array<FakeModel>
  defaultThinkingLevel?: string
  enabledModels?: Array<string>
} = {}) {
  const models = all ?? [createModel("google", "gemini-3.5-flash")]
  const availableModels = available ?? models

  return {
    modelRegistry: {
      find: vi.fn((provider: string, id: string) =>
        models.find((model) => model.provider === provider && model.id === id)
      ),
      getAll: vi.fn(() => models),
      getAvailable: vi.fn(() => availableModels),
    },
    resourceLoader: {
      getAgentsFiles: vi.fn(() => ({
        agentsFiles: [{ path: "/repo/AGENTS.md" }],
      })),
      getExtensions: vi.fn(() => ({
        extensions: [
          {
            path: "/repo/.pi/extensions/project-inventory.ts",
            resolvedPath: "/repo/.pi/extensions/project-inventory.ts",
            sourceInfo: { source: "project" },
          },
          {
            path: "/repo/.pi/extensions/vendor/subagents/index.ts",
            resolvedPath: "/repo/.pi/extensions/vendor/subagents/index.ts",
          },
        ],
      })),
      getPrompts: vi.fn(() => ({
        prompts: [
          {
            name: "starter-prompt",
            description: "Prompt",
            filePath: "/repo/.pi/prompts/starter.md",
            argumentHint: "topic",
            sourceInfo: { source: "project" },
          },
        ],
      })),
      getSkills: vi.fn(() => ({
        skills: [
          {
            name: "starter-skill",
            description: "Skill",
            filePath: "/repo/.pi/skills/starter/SKILL.md",
            sourceInfo: { source: "project" },
          },
        ],
      })),
      getThemes: vi.fn(() => ({
        themes: [
          {
            id: "night",
            path: "/repo/.pi/themes/night.json",
          },
        ],
      })),
    },
    settingsManager: {
      getDefaultProvider: vi.fn(() => "google"),
      getDefaultModel: vi.fn(() => "gemini-3.5-flash"),
      getDefaultThinkingLevel: vi.fn(() => defaultThinkingLevel),
      getEnabledModels: vi.fn(() => enabledModels),
      getEnableSkillCommands: vi.fn(() => true),
    },
    diagnostics: [],
  }
}

describe("server catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveDefaultModelSelection.mockReturnValue({
      defaultProvider: "google",
      defaultModel: "gemini-3.5-flash",
    })
  })

  it("lists only available models and applies default thinking metadata", async () => {
    const services = createServices({
      all: [
        createModel("google", "gemini-3.5-flash", {
          contextWindow: 1000,
          maxTokens: 200,
        }),
        createModel("openai", "gpt-5"),
      ],
      available: [
        createModel("google", "gemini-3.5-flash", {
          contextWindow: 1000,
          maxTokens: 200,
        }),
      ],
    })
    mocks.createSessionServices.mockResolvedValue(services)

    const response = await loadChatModels({ projectRoot: "/repo" } as never)

    expect(response.selectedModelKey).toBe("google/gemini-3.5-flash")
    expect(response.models).toEqual([
      expect.objectContaining({
        key: "google/gemini-3.5-flash",
        available: true,
        contextWindow: 1000,
        maxTokens: 200,
        defaultThinkingLevel: "medium",
      }),
    ])
    expect(response.diagnostics).toEqual(["runtime diagnostic"])
  })

  it("falls back to all models and prepends an unavailable configured default", async () => {
    mocks.resolveDefaultModelSelection.mockReturnValue({
      defaultProvider: "google",
      defaultModel: "gemini-missing",
    })
    mocks.createSessionServices.mockResolvedValue(
      createServices({
        all: [createModel("openai", "gpt-5")],
        available: [],
        defaultThinkingLevel: "invalid",
      })
    )

    const response = await loadChatModels({ projectRoot: "/repo" } as never)

    expect(response.selectedModelKey).toBe("google/gemini-missing")
    expect(response.models[0]).toMatchObject({
      key: "google/gemini-missing",
      provider: "google",
      id: "gemini-missing",
      available: false,
      defaultThinkingLevel: undefined,
    })
    expect(response.models[1]).toMatchObject({
      key: "openai/gpt-5",
      available: true,
    })
  })

  it("resolves legacy and structured Bedrock selections through regional aliases", () => {
    const bedrockModel = createModel(
      "amazon-bedrock",
      "us.anthropic.claude-sonnet-4-5"
    )
    const services = createServices({
      all: [bedrockModel],
      available: [bedrockModel],
    })

    expect(
      resolveModelSelection(
        services as never,
        "us.anthropic.claude-sonnet-4-5[thinking]"
      ).model
    ).toBe(bedrockModel)
    expect(
      resolveModelSelection(services as never, {
        provider: "amazon-bedrock",
        id: "anthropic.claude-sonnet-4-5",
        thinkingLevel: "high",
      }).thinkingLevel
    ).toBe("high")
  })

  it("applies selected models and thinking levels to an active runtime", async () => {
    const originalModel = createModel("google", "gemini-3.5-flash")
    const nextModel = createModel("openai", "gpt-5")
    const services = createServices({
      all: [originalModel, nextModel],
      available: [originalModel, nextModel],
    })
    const runtime = {
      services,
      session: {
        model: originalModel,
        setModel: vi.fn(),
        setThinkingLevel: vi.fn(),
      },
    }

    await applyModelSelection(runtime as never, {
      provider: "openai",
      id: "gpt-5",
      thinkingLevel: "low",
    })

    expect(runtime.session.setModel).toHaveBeenCalledWith(nextModel)
    expect(runtime.session.setThinkingLevel).toHaveBeenCalledWith("low")
  })

  it("filters models using enabledModels glob patterns", async () => {
    const services = createServices({
      all: [
        createModel("google", "gemini-3.5-flash"),
        createModel("openai", "gpt-5"),
      ],
      available: [
        createModel("google", "gemini-3.5-flash"),
        createModel("openai", "gpt-5"),
      ],
      enabledModels: ["google/*"],
    })
    mocks.createSessionServices.mockResolvedValue(services)

    const response = await loadChatModels({ projectRoot: "/repo" } as never)

    expect(response.models).toHaveLength(1)
    expect(response.models[0]).toMatchObject({
      key: "google/gemini-3.5-flash",
    })
  })

  it("merges runtime resources with workspace overlay and expectation diagnostics", async () => {
    mocks.createSessionServices.mockResolvedValue(createServices())

    const response = await loadChatResources({ projectRoot: "/repo" } as never)

    expect(response.packages).toEqual([
      { name: "pi-web-access", path: "agent-workspace/pi/packages" },
    ])
    expect(response.skills).toEqual([
      expect.objectContaining({ name: "starter-skill" }),
    ])
    expect(response.extensions).toEqual([
      expect.objectContaining({ name: "project-inventory", source: "project" }),
      expect.objectContaining({ name: "subagents" }),
    ])
    expect(response.themes).toEqual([
      { name: "night", path: "/repo/.pi/themes/night.json" },
    ])
    expect(response.agentsFiles).toEqual([
      { name: "AGENTS.md", path: "/repo/AGENTS.md" },
    ])
    expect(response.diagnostics).toEqual([
      "runtime diagnostic",
      "resource expectation diagnostic",
    ])
  })
})
