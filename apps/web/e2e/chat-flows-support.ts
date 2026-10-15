 
 
import { expect } from "@playwright/test"
import type { Locator, Page, Route } from "@playwright/test"

export const MOCK_SESSION_FILE = "/tmp/fleet-pi-test-session.json"
export const MOCK_SESSION_ID = "test-session-id"

export const MOCK_MODELS = {
  models: [
    {
      key: "amazon-bedrock/us.anthropic.claude-sonnet-4-6",
      provider: "amazon-bedrock",
      id: "us.anthropic.claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      reasoning: true,
      input: ["text"],
      available: true,
    },
    {
      key: "amazon-bedrock/us.anthropic.claude-opus-4-6",
      provider: "amazon-bedrock",
      id: "us.anthropic.claude-opus-4-6",
      name: "Claude Opus 4.6",
      reasoning: true,
      input: ["text"],
      available: true,
    },
  ],
  selectedModelKey: "amazon-bedrock/us.anthropic.claude-sonnet-4-6",
  diagnostics: [],
}

export const FACTORY_FILE_PATH = "agent-workspace/memory/research/factory.md"
export const LARGE_REPORT_PATH =
  "agent-workspace/artifacts/reports/large-report.md"
export const BINARY_REPORT_PATH =
  "agent-workspace/artifacts/reports/binary-report.bin"
export const BROKEN_REPORT_PATH = "agent-workspace/artifacts/reports/broken.md"

export const MOCK_RESOURCES = {
  packages: [
    {
      name: "example-package",
      path: "agent-workspace/pi/packages/example-package",
      workspacePath: "agent-workspace/pi/packages/example-package",
      source: "workspace",
      activationStatus: "reload-required",
      installedInWorkspace: true,
    },
  ],
  skills: [
    {
      name: "frontend-helper",
      description: "Workspace-installed helper skill.",
      path: "agent-workspace/pi/skills/frontend-helper/SKILL.md",
      workspacePath: "agent-workspace/pi/skills/frontend-helper/SKILL.md",
      source: "workspace",
      activationStatus: "active",
      installedInWorkspace: true,
    },
  ],
  prompts: [
    {
      name: "daily-brief",
      description: "Workspace-installed daily brief prompt.",
      path: "agent-workspace/pi/prompts/daily-brief.md",
      workspacePath: "agent-workspace/pi/prompts/daily-brief.md",
      source: "workspace",
      activationStatus: "active",
      installedInWorkspace: true,
    },
    {
      name: "autoctx-improve",
      description:
        "Iteratively improve recent work through judge-guided feedback loops",
      path: "/tmp/fleet-pi/.pi/npm/node_modules/pi-autocontext/prompts/autoctx-improve.md",
      source: "npm:pi-autocontext",
    },
    {
      name: "autoctx-judge",
      description:
        "Evaluate the quality of recent work using autocontext judging",
      path: "/tmp/fleet-pi/.pi/npm/node_modules/pi-autocontext/prompts/autoctx-judge.md",
      source: "npm:pi-autocontext",
    },
    {
      name: "autoctx-status",
      description: "Check autocontext project status and recent runs",
      path: "/tmp/fleet-pi/.pi/npm/node_modules/pi-autocontext/prompts/autoctx-status.md",
      source: "npm:pi-autocontext",
    },
  ],
  extensions: [
    {
      name: "live-tool",
      path: "agent-workspace/pi/extensions/enabled/live-tool.ts",
      workspacePath: "agent-workspace/pi/extensions/enabled/live-tool.ts",
      source: "workspace",
      activationStatus: "active",
      installedInWorkspace: true,
    },
    {
      name: "draft-tool",
      path: "agent-workspace/pi/extensions/staged/draft-tool.ts",
      workspacePath: "agent-workspace/pi/extensions/staged/draft-tool.ts",
      source: "workspace",
      activationStatus: "staged",
      installedInWorkspace: true,
    },
    {
      name: "project-inventory",
      path: "/tmp/fleet-pi/.pi/extensions/project-inventory.ts",
      source: "project",
    },
    {
      name: "pi-autoresearch",
      path: "/tmp/fleet-pi/.pi/npm/node_modules/pi-autoresearch/extensions/pi-autoresearch/index.ts",
      source: "npm:pi-autoresearch",
    },
    {
      name: "pi-skill-palette",
      path: "/tmp/fleet-pi/.pi/npm/node_modules/pi-skill-palette/index.ts",
      source: "npm:pi-skill-palette",
    },
    {
      name: "pi-autocontext",
      path: "/tmp/fleet-pi/.pi/npm/node_modules/pi-autocontext/src/index.ts",
      source: "npm:pi-autocontext",
    },
    {
      name: "filechanges",
      path: "/tmp/fleet-pi/.pi/extensions/vendor/filechanges/index.ts",
      source: "project",
    },
    {
      name: "subagents",
      path: "/tmp/fleet-pi/.pi/extensions/vendor/subagents/index.ts",
      source: "project",
    },
  ],
  themes: [],
  agentsFiles: [
    {
      name: "AGENTS.md",
      path: "/tmp/fleet-pi/AGENTS.md",
    },
  ],
  diagnostics: [
    'Tool "web_fetch" conflicts with the staged workspace extension and needs a reload.',
  ],
}

export const MOCK_SETTINGS = {
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
    retry: {
      enabled: true,
      maxRetries: 3,
      baseDelayMs: 2000,
    },
    skills: ["../agent-workspace/pi/skills"],
    steeringMode: "one-at-a-time",
    themes: [],
    transport: "auto",
  },
  project: {
    packages: ["npm:pi-autocontext"],
  },
  projectPath: ".pi/settings.json",
  updateImpact: {
    newSessionRecommended: true,
    resourceReloadRequired: true,
  },
}

type MockWorkspaceTreeNode = {
  children?: Array<MockWorkspaceTreeNode>
  name: string
  path: string
  type: "directory" | "file"
}

type MockWorkspaceTreeResponse = {
  diagnostics: Array<string>
  nodes: Array<MockWorkspaceTreeNode>
  root: string
}

export const MOCK_WORKSPACE_TREE: MockWorkspaceTreeResponse = {
  root: "agent-workspace",
  nodes: [
    {
      name: "artifacts",
      path: "agent-workspace/artifacts",
      type: "directory",
      children: [
        {
          name: "reports",
          path: "agent-workspace/artifacts/reports",
          type: "directory",
          children: [
            {
              name: "summary.md",
              path: "agent-workspace/artifacts/reports/summary.md",
              type: "file",
            },
            {
              name: "large-report.md",
              path: LARGE_REPORT_PATH,
              type: "file",
            },
            {
              name: "binary-report.bin",
              path: BINARY_REPORT_PATH,
              type: "file",
            },
            {
              name: "broken.md",
              path: BROKEN_REPORT_PATH,
              type: "file",
            },
          ],
        },
      ],
    },
    {
      name: "evals",
      path: "agent-workspace/evals",
      type: "directory",
      children: [],
    },
    {
      name: "indexes",
      path: "agent-workspace/indexes",
      type: "directory",
      children: [],
    },
    {
      name: "instructions",
      path: "agent-workspace/instructions",
      type: "directory",
      children: [
        {
          name: "mission-brief.md",
          path: "agent-workspace/instructions/mission-brief.md",
          type: "file",
        },
      ],
    },
    {
      name: "memory",
      path: "agent-workspace/memory",
      type: "directory",
      children: [
        {
          name: "daily",
          path: "agent-workspace/memory/daily",
          type: "directory",
          children: [
            {
              name: "2026-05-01.md",
              path: "agent-workspace/memory/daily/2026-05-01.md",
              type: "file",
            },
          ],
        },
        {
          name: "project",
          path: "agent-workspace/memory/project",
          type: "directory",
          children: [
            {
              name: "architecture.md",
              path: "agent-workspace/memory/project/architecture.md",
              type: "file",
            },
          ],
        },
        {
          name: "research",
          path: "agent-workspace/memory/research",
          type: "directory",
          children: [
            {
              name: "factory.md",
              path: FACTORY_FILE_PATH,
              type: "file",
            },
            {
              name: "hermes.md",
              path: "agent-workspace/memory/research/hermes.md",
              type: "file",
            },
          ],
        },
      ],
    },
    {
      name: "pi",
      path: "agent-workspace/pi",
      type: "directory",
      children: [
        {
          name: "extensions",
          path: "agent-workspace/pi/extensions",
          type: "directory",
          children: [
            {
              name: "enabled",
              path: "agent-workspace/pi/extensions/enabled",
              type: "directory",
              children: [
                {
                  name: "live-tool.ts",
                  path: "agent-workspace/pi/extensions/enabled/live-tool.ts",
                  type: "file",
                },
              ],
            },
            {
              name: "staged",
              path: "agent-workspace/pi/extensions/staged",
              type: "directory",
              children: [
                {
                  name: "draft-tool.ts",
                  path: "agent-workspace/pi/extensions/staged/draft-tool.ts",
                  type: "file",
                },
              ],
            },
          ],
        },
        {
          name: "packages",
          path: "agent-workspace/pi/packages",
          type: "directory",
          children: [
            {
              name: "example-package",
              path: "agent-workspace/pi/packages/example-package",
              type: "directory",
              children: [
                {
                  name: "package.json",
                  path: "agent-workspace/pi/packages/example-package/package.json",
                  type: "file",
                },
              ],
            },
          ],
        },
        {
          name: "prompts",
          path: "agent-workspace/pi/prompts",
          type: "directory",
          children: [
            {
              name: "daily-brief.md",
              path: "agent-workspace/pi/prompts/daily-brief.md",
              type: "file",
            },
          ],
        },
        {
          name: "skills",
          path: "agent-workspace/pi/skills",
          type: "directory",
          children: [
            {
              name: "frontend-helper",
              path: "agent-workspace/pi/skills/frontend-helper",
              type: "directory",
              children: [
                {
                  name: "SKILL.md",
                  path: "agent-workspace/pi/skills/frontend-helper/SKILL.md",
                  type: "file",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "plans",
      path: "agent-workspace/plans",
      type: "directory",
      children: [
        {
          name: "active",
          path: "agent-workspace/plans/active",
          type: "directory",
          children: [
            {
              name: "workspace-refresh.md",
              path: "agent-workspace/plans/active/workspace-refresh.md",
              type: "file",
            },
          ],
        },
      ],
    },
    {
      name: "system",
      path: "agent-workspace/system",
      type: "directory",
      children: [
        {
          name: "behavior.md",
          path: "agent-workspace/system/behavior.md",
          type: "file",
        },
        {
          name: "constraints.md",
          path: "agent-workspace/system/constraints.md",
          type: "file",
        },
        {
          name: "identity.md",
          path: "agent-workspace/system/identity.md",
          type: "file",
        },
        {
          name: "self-improvement-policy.md",
          path: "agent-workspace/system/self-improvement-policy.md",
          type: "file",
        },
        {
          name: "tool-policy.md",
          path: "agent-workspace/system/tool-policy.md",
          type: "file",
        },
        {
          name: "workspace-policy.md",
          path: "agent-workspace/system/workspace-policy.md",
          type: "file",
        },
      ],
    },
    {
      name: "scratch",
      path: "agent-workspace/scratch",
      type: "directory",
      children: [
        {
          name: "tmp",
          path: "agent-workspace/scratch/tmp",
          type: "directory",
          children: [
            {
              name: ".gitkeep",
              path: "agent-workspace/scratch/tmp/.gitkeep",
              type: "file",
            },
          ],
        },
      ],
    },
    {
      name: "skills",
      path: "agent-workspace/skills",
      type: "directory",
      children: [
        {
          name: "codebase-research",
          path: "agent-workspace/skills/codebase-research",
          type: "directory",
          children: [
            {
              name: "SKILL.md",
              path: "agent-workspace/skills/codebase-research/SKILL.md",
              type: "file",
            },
          ],
        },
        {
          name: "doc-gardening",
          path: "agent-workspace/skills/doc-gardening",
          type: "directory",
          children: [
            {
              name: "SKILL.md",
              path: "agent-workspace/skills/doc-gardening/SKILL.md",
              type: "file",
            },
          ],
        },
        {
          name: "execution-plan",
          path: "agent-workspace/skills/execution-plan",
          type: "directory",
          children: [
            {
              name: "SKILL.md",
              path: "agent-workspace/skills/execution-plan/SKILL.md",
              type: "file",
            },
          ],
        },
        {
          name: "frontend-design",
          path: "agent-workspace/skills/frontend-design",
          type: "directory",
          children: [
            {
              name: "SKILL.md",
              path: "agent-workspace/skills/frontend-design/SKILL.md",
              type: "file",
            },
          ],
        },
        {
          name: "memory-synthesis",
          path: "agent-workspace/skills/memory-synthesis",
          type: "directory",
          children: [
            {
              name: "SKILL.md",
              path: "agent-workspace/skills/memory-synthesis/SKILL.md",
              type: "file",
            },
          ],
        },
      ],
    },
    {
      name: "index.md",
      path: "agent-workspace/index.md",
      type: "file",
    },
    {
      name: "manifest.json",
      path: "agent-workspace/manifest.json",
      type: "file",
    },
    {
      name: "README.md",
      path: "agent-workspace/README.md",
      type: "file",
    },
  ],
  diagnostics: ["Projection health degraded: pending reindex"],
}

export const MOCK_WORKSPACE_TREE_WITHOUT_FACTORY = (() => {
  const tree = structuredClone(MOCK_WORKSPACE_TREE)
  const memoryNode = tree.nodes.find(
    (node) => node.path === "agent-workspace/memory"
  )
  const researchNode = memoryNode?.children?.find(
    (node) => node.path === "agent-workspace/memory/research"
  )
  if (researchNode?.children) {
    researchNode.children = researchNode.children.filter(
      (node) => node.path !== FACTORY_FILE_PATH
    )
  }
  return tree
})()

type MockWorkspaceFileEntry = {
  body: Record<string, unknown>
  status: number
}

export const MOCK_WORKSPACE_FILES = new Map<string, MockWorkspaceFileEntry>([
  [
    FACTORY_FILE_PATH,
    {
      status: 200,
      body: {
        path: FACTORY_FILE_PATH,
        name: "factory.md",
        content:
          "# Factory\n\nPurpose: Research notes for Factory.\n\nStatus: Seeded stub.\n",
        mediaType: "text/markdown",
        status: "ok",
      },
    },
  ],
  [
    "agent-workspace/artifacts/reports/summary.md",
    {
      status: 200,
      body: {
        path: "agent-workspace/artifacts/reports/summary.md",
        name: "summary.md",
        content: "# Summary\n\nArtifact report preview.\n",
        mediaType: "text/markdown",
        status: "ok",
      },
    },
  ],
  [
    "agent-workspace/memory/project/architecture.md",
    {
      status: 200,
      body: {
        path: "agent-workspace/memory/project/architecture.md",
        name: "architecture.md",
        content: "# Architecture\n\nProject memory architecture notes.\n",
        mediaType: "text/markdown",
        status: "ok",
      },
    },
  ],
  [
    "agent-workspace/pi/prompts/daily-brief.md",
    {
      status: 200,
      body: {
        path: "agent-workspace/pi/prompts/daily-brief.md",
        name: "daily-brief.md",
        content: "# Daily Brief\n\n- Review workspace diagnostics.\n",
        mediaType: "text/markdown",
        status: "ok",
      },
    },
  ],
  [
    LARGE_REPORT_PATH,
    {
      status: 200,
      body: {
        path: LARGE_REPORT_PATH,
        name: "large-report.md",
        content: "",
        mediaType: "text/plain",
        size: 300000,
        status: "too-large",
      },
    },
  ],
  [
    BINARY_REPORT_PATH,
    {
      status: 200,
      body: {
        path: BINARY_REPORT_PATH,
        name: "binary-report.bin",
        content: "",
        mediaType: "application/octet-stream",
        size: 128,
        status: "unsupported",
      },
    },
  ],
  [
    BROKEN_REPORT_PATH,
    {
      status: 503,
      body: {
        message: "Workspace preview is temporarily unavailable.",
      },
    },
  ],
])

export function mockChatModels(page: Page) {
  return page.route(
    "http://localhost:3000/api/chat/models",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_MODELS),
      })
    }
  )
}

export function mockChatSessions(page: Page) {
  return page.route(
    "http://localhost:3000/api/chat/sessions",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [] }),
      })
    }
  )
}

export function mockChatResources(page: Page, resources = MOCK_RESOURCES) {
  return page.route(
    "http://localhost:3000/api/chat/resources",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(resources),
      })
    }
  )
}

export function mockChatSettings(page: Page, settings = MOCK_SETTINGS) {
  let current = structuredClone(settings)
  return page.route(
    "http://localhost:3000/api/chat/settings",
    async (route: Route) => {
      if (route.request().method() === "PATCH") {
        const body = (await route.request().postDataJSON()) as {
          settings?: Record<string, unknown>
        }
        current = {
          ...current,
          effective: {
            ...current.effective,
            ...(body.settings ?? {}),
          },
          project: {
            ...current.project,
            ...(body.settings ?? {}),
          },
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(current),
      })
    }
  )
}

export function mockChatCommands(page: Page) {
  return page.route(
    "http://localhost:3000/api/chat/commands",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ commands: [] }),
      })
    }
  )
}

export function mockChatProviders(page: Page) {
  return page.route(
    "http://localhost:3000/api/chat/providers",
    async (route: Route) => {
      if (route.request().method() !== "GET") {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ providers: [] }),
      })
    }
  )
}

export function mockWorkspaceTree(
  page: Page,
  responses = [MOCK_WORKSPACE_TREE]
) {
  let requestIndex = 0
  return page.route(
    "http://localhost:3000/api/workspace/tree",
    async (route: Route) => {
      const response =
        responses[Math.min(requestIndex, responses.length - 1)] ??
        MOCK_WORKSPACE_TREE
      requestIndex += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      })
    }
  )
}

export function mockWorkspaceFile(page: Page, files = MOCK_WORKSPACE_FILES) {
  return page.route(
    "http://localhost:3000/api/workspace/file?**",
    async (route: Route) => {
      const url = new URL(route.request().url())
      const path = url.searchParams.get("path") ?? ""
      const file = files.get(path)

      await route.fulfill({
        status: file?.status ?? 404,
        contentType: "application/json",
        body: JSON.stringify(
          file?.body ?? { message: `No mocked workspace file for ${path}` }
        ),
      })
    }
  )
}

export async function scrollPanelToEnd(panel: Locator) {
  const scroller = panel.locator(".overflow-y-auto").first()
  await expect(scroller).toBeVisible()
  await expect
    .poll(async () =>
      scroller.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    )
    .toBe(true)
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
}

export async function expandWorkspacePath(
  tree: Locator,
  segments: Array<string>
) {
  for (const segment of segments) {
    await tree.getByRole("button", { name: segment, exact: true }).click()
  }
}

export function mockChatNew(page: Page) {
  return page.route(
    "http://localhost:3000/api/chat/new",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            sessionFile: MOCK_SESSION_FILE,
            sessionId: MOCK_SESSION_ID,
          },
          messages: [],
        }),
      })
    }
  )
}

export function mockChatSession(page: Page) {
  return page.route(
    "http://localhost:3000/api/chat/session?**",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            sessionFile: MOCK_SESSION_FILE,
            sessionId: MOCK_SESSION_ID,
          },
          messages: [
            {
              id: "user-msg-1",
              role: "user",
              createdAt: Date.now() - 1000,
              parts: [{ type: "text", text: "Hello Pi" }],
            },
            {
              id: "assistant-msg-1",
              role: "assistant",
              createdAt: Date.now(),
              parts: [
                { type: "text", text: "Hello! How can I help you today?" },
              ],
            },
          ],
        }),
      })
    }
  )
}

export function mockPendingChatSession(page: Page) {
  return page.route(
    "http://localhost:3000/api/chat/session?**",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            sessionFile: MOCK_SESSION_FILE,
            sessionId: MOCK_SESSION_ID,
          },
          messages: [
            {
              id: "user-msg-pending",
              role: "user",
              createdAt: Date.now() - 1000,
              parts: [{ type: "text", text: "Continue the pending task" }],
            },
          ],
        }),
      })
    }
  )
}

export function mockChatStream(
  page: Page,
  options: {
    assistantText?: string
    planMode?: boolean
    toolParts?: Array<Record<string, unknown>>
  } = {}
) {
  const assistantId = `assistant-${Date.now()}`
  const runId = `run-${assistantId}`
  const text = options.assistantText ?? "Hello! How can I help you today?"
  const chunks = text.split(" ")
  const todos = options.planMode
    ? text
        .split("\n")
        .map((line) => {
          const match = line.match(/^(\d+)\.\s+(.*)$/)
          if (!match) return null
          return {
            step: Number(match[1]),
            text: match[2],
            completed: false,
          }
        })
        .filter((todo): todo is NonNullable<typeof todo> => todo !== null)
    : []

  return page.route("http://localhost:3000/api/chat", async (route: Route) => {
    const request = route.request()
    if (request.method() !== "POST") {
      await route.continue()
      return
    }

    const events: Array<string> = []
    events.push(
      JSON.stringify({
        type: "start",
        id: assistantId,
        runId,
        sessionFile: MOCK_SESSION_FILE,
        sessionId: MOCK_SESSION_ID,
      })
    )

    for (let i = 0; i < chunks.length; i++) {
      const prefix = i === 0 ? "" : " "
      events.push(
        JSON.stringify({
          type: "delta",
          text: `${prefix}${chunks[i]}`,
        })
      )
    }

    if (options.planMode) {
      events.push(
        JSON.stringify({
          type: "plan",
          mode: "plan",
          executing: false,
          completed: 0,
          total: todos.length,
          message: `Plan ready: 0/${todos.length} steps done`,
          state: {
            mode: "plan",
            executing: false,
            pendingDecision: true,
            completed: 0,
            total: todos.length,
            todos,
            message: `Plan ready: 0/${todos.length} steps done`,
          },
        })
      )
    }

    events.push(
      JSON.stringify({
        type: "done",
        runId,
        message: {
          id: assistantId,
          role: "assistant",
          createdAt: Date.now(),
          parts: options.planMode
            ? [
                { type: "text", text },
                {
                  type: "tool-PlanWrite",
                  toolCallId: `plan-mode-decision-${assistantId}`,
                  state: "output-available",
                  input: {
                    action: "create",
                    pendingDecision: true,
                    executing: false,
                    completed: 0,
                    total: todos.length,
                    plan: {
                      id: assistantId,
                      title: "Execution plan",
                      summary: todos.map((todo) => todo.text).join("; "),
                      status: "awaiting_approval",
                      todos,
                    },
                  },
                },
              ]
            : [...(options.toolParts ?? []), { type: "text", text }],
        },
        sessionFile: MOCK_SESSION_FILE,
        sessionId: MOCK_SESSION_ID,
      })
    )

    const body = events.join("\n") + "\n"

    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body,
    })
  })
}
