/* eslint-disable max-lines -- this end-to-end suite intentionally keeps the mocked chat harness together */
/* eslint-disable max-lines-per-function -- shared mocked chat harness keeps the suite readable in one place */
import { expect, test } from "@playwright/test"
import type { Locator, Page, Route } from "@playwright/test"

const MOCK_SESSION_FILE = "/tmp/fleet-pi-test-session.json"
const MOCK_SESSION_ID = "test-session-id"

const MOCK_MODELS = {
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

const FACTORY_FILE_PATH = "agent-workspace/memory/research/factory.md"
const LARGE_REPORT_PATH = "agent-workspace/artifacts/reports/large-report.md"
const BINARY_REPORT_PATH = "agent-workspace/artifacts/reports/binary-report.bin"
const BROKEN_REPORT_PATH = "agent-workspace/artifacts/reports/broken.md"

const MOCK_RESOURCES = {
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

const MOCK_WORKSPACE_TREE: MockWorkspaceTreeResponse = {
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
      name: "policies",
      path: "agent-workspace/policies",
      type: "directory",
      children: [
        {
          name: "constraints.md",
          path: "agent-workspace/policies/constraints.md",
          type: "file",
        },
        {
          name: "self-improvement-policy.md",
          path: "agent-workspace/policies/self-improvement-policy.md",
          type: "file",
        },
        {
          name: "tool-policy.md",
          path: "agent-workspace/policies/tool-policy.md",
          type: "file",
        },
        {
          name: "workspace-policy.md",
          path: "agent-workspace/policies/workspace-policy.md",
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
      name: "system",
      path: "agent-workspace/system",
      type: "directory",
      children: [
        {
          name: "identity.md",
          path: "agent-workspace/system/identity.md",
          type: "file",
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

const MOCK_WORKSPACE_TREE_WITHOUT_FACTORY = (() => {
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

const MOCK_WORKSPACE_FILES = new Map<string, MockWorkspaceFileEntry>([
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

function mockChatModels(page: Page) {
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

function mockChatSessions(page: Page) {
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

function mockChatResources(page: Page, resources = MOCK_RESOURCES) {
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

function mockWorkspaceTree(page: Page, responses = [MOCK_WORKSPACE_TREE]) {
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

function mockWorkspaceFile(page: Page, files = MOCK_WORKSPACE_FILES) {
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

async function scrollPanelToEnd(panel: Locator) {
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

async function expandWorkspacePath(tree: Locator, segments: Array<string>) {
  for (const segment of segments) {
    await tree.getByRole("button", { name: segment, exact: true }).click()
  }
}

function mockChatNew(page: Page) {
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

function mockChatSession(page: Page) {
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

function mockChatStream(
  page: Page,
  options: {
    assistantText?: string
    planMode?: boolean
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
            : [{ type: "text", text }],
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

test.describe("chat flows", () => {
  test("page loads and chat UI is visible", async ({ page }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)

    await page.goto("/")
    await expect(page.getByTestId("chat-shell")).toBeVisible()

    const textarea = page.getByRole("textbox", {
      name: "Send a message...",
    })
    await expect(textarea).toBeVisible()

    const newSessionButton = page.locator('[aria-label="New session"]')
    await expect(newSessionButton).toBeVisible()
    await expect(newSessionButton).toContainText("New session")

    const accountMenuButton = page.locator('[aria-label="Open account menu"]')
    await expect(accountMenuButton).toBeVisible()

    const sessionMenuButton = page.locator('[aria-label="Open conversations"]')
    await expect(sessionMenuButton).toBeVisible()
    await expect(sessionMenuButton).toContainText("Session")

    const modelPicker = page.locator('[aria-label="Select model"]')
    await expect(modelPicker).toBeVisible()

    const modeSelector = page.locator('[aria-label="Select mode"]')
    await expect(modeSelector).toBeVisible()
  })

  test("creates new session and shows empty state", async ({ page }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockChatNew(page)

    await page.goto("/")
    await expect(page.getByTestId("chat-shell")).toBeVisible()

    const newSessionButton = page.locator('[aria-label="New session"]')
    await expect(newSessionButton).toBeVisible()
    await newSessionButton.click()

    const textarea = page.getByRole("textbox", {
      name: "Send a message...",
    })
    await expect(textarea).toBeVisible()

    await expect(page.locator("text=Summarize this project")).toBeVisible()
    await expect(page.locator("text=Explore available skills")).toBeVisible()
    await expect(page.locator("text=Read AGENTS.md")).toBeVisible()

    const chatColumn = page.getByTestId("chat-column")
    const chatColumnBox = await chatColumn.boundingBox()
    const textareaBox = await textarea.boundingBox()
    expect(chatColumnBox).not.toBeNull()
    expect(textareaBox).not.toBeNull()
    expect(textareaBox?.y ?? 0).toBeGreaterThan(
      (chatColumnBox?.y ?? 0) + (chatColumnBox?.height ?? 0) * 0.65
    )
  })

  test("first browser visit boots panels and persists one fresh session", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockChatStream(page, {
      assistantText: "First visit ready.",
    })

    let sessionHydrationRequests = 0
    let chatPostRequests = 0

    page.on("request", (request) => {
      if (request.url().startsWith("http://localhost:3000/api/chat/session?")) {
        sessionHydrationRequests += 1
      }
      if (
        request.url() === "http://localhost:3000/api/chat" &&
        request.method() === "POST"
      ) {
        chatPostRequests += 1
      }
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("fleet-pi-chat-session")
        )
      )
      .toBe(null)
    expect(sessionHydrationRequests).toBe(0)

    await page.locator('[aria-label="Pi resources"]').click()
    await expect(
      page.locator('[data-testid="pi-resources-canvas"]')
    ).toBeVisible()
    await page.getByRole("button", { name: "Workspace", exact: true }).click()
    await expect(
      page.locator('[data-testid="pi-workspace-canvas"]')
    ).toBeVisible()

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await expect(textarea).toBeVisible()
    await textarea.fill("Start the first session")
    await page.keyboard.press("Enter")

    await expect(
      page.locator("text=Start the first session").first()
    ).toBeVisible()
    await expect(page.locator("text=First visit ready.")).toBeVisible({
      timeout: 10000,
    })

    expect(chatPostRequests).toBe(1)
    expect(sessionHydrationRequests).toBe(0)

    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("fleet-pi-chat-session")
        )
      )
      .not.toBe(null)

    const storedSession = await page.evaluate(() => {
      const raw = window.localStorage.getItem("fleet-pi-chat-session")
      return raw ? JSON.parse(raw) : null
    })

    expect(storedSession).toEqual({
      sessionFile: MOCK_SESSION_FILE,
      sessionId: MOCK_SESSION_ID,
    })
  })

  test("sends message and streaming content appears", async ({ page }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockChatStream(page, {
      assistantText: "Hello! How can I help you today?",
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await expect(textarea).toBeVisible()
    await textarea.click()
    await textarea.fill("Hello Pi")
    await page.keyboard.press("Enter")

    await expect(page.locator("text=Hello Pi").first()).toBeVisible()

    await expect(
      page.locator("text=Hello! How can I help you today?")
    ).toBeVisible({ timeout: 10000 })
  })

  test("updates suggestions based on the conversation context", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockChatStream(page, {
      assistantText: "I can help you explore the project and available skills.",
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await textarea.fill("What can you do?")
    await page.keyboard.press("Enter")

    await expect(page.locator("text=What can you do?").first()).toBeVisible()
    await expect(page.locator('text=Find a skill "frontend"')).toBeVisible()
    await expect(page.locator("text=Read AGENTS.md")).toBeVisible()
    await expect(page.locator("text=Show workspace files")).toBeVisible()

    const frontendSuggestion = page.getByRole("button", {
      name: 'Find a skill "frontend"',
    })
    const agentsSuggestion = page.getByRole("button", {
      name: "Read AGENTS.md",
    })
    const frontendBox = await frontendSuggestion.boundingBox()
    const agentsBox = await agentsSuggestion.boundingBox()
    expect(frontendBox).not.toBeNull()
    expect(agentsBox).not.toBeNull()
    expect(agentsBox?.y ?? 0).toBeGreaterThan(frontendBox?.y ?? 0)
    const restingBackground = await frontendSuggestion.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    )
    await expect(frontendSuggestion).toHaveCSS("padding-left", "12px")
    await expect(frontendSuggestion).toHaveCSS("padding-right", "12px")
    await frontendSuggestion.hover()
    await expect
      .poll(async () =>
        frontendSuggestion.evaluate(
          (element) => getComputedStyle(element).backgroundColor
        )
      )
      .not.toBe(restingBackground)
  })

  test("reloads page and restores messages from session hydration", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockChatStream(page, {
      assistantText: "Hello! How can I help you today?",
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await expect(textarea).toBeVisible()
    await textarea.click()
    await textarea.fill("Hello Pi")
    await page.keyboard.press("Enter")

    await expect(
      page.locator("text=Hello! How can I help you today?")
    ).toBeVisible({ timeout: 10000 })

    await mockChatSession(page)
    await page.reload()

    await expect(page.locator("text=Hello Pi").first()).toBeVisible({
      timeout: 10000,
    })

    await expect(
      page.locator("text=Hello! How can I help you today?")
    ).toBeVisible({ timeout: 10000 })
  })

  test("opens model picker and changes selection", async ({ page }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const modelPicker = page.locator('[aria-label="Select model"]')
    await expect(modelPicker).toBeVisible()

    await expect(modelPicker).toContainText("Claude Sonnet 4.6")

    await modelPicker.click()

    const popover = page.locator('[role="dialog"]')
    await expect(popover).toBeVisible()

    const opusOption = popover.locator("text=Claude Opus 4.6")
    await expect(opusOption).toBeVisible()
    await opusOption.click()

    await expect(popover).not.toBeVisible()

    await expect(modelPicker).toContainText("Claude Opus 4.6")
  })

  test("keeps conversations and New session header controls compact", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Workspace", exact: true }).click()

    const conversationsButton = page.locator(
      '[aria-label="Open conversations"]'
    )
    const newSessionButton = page.locator('[aria-label="New session"]')
    await expect(conversationsButton).toBeVisible()
    await expect(newSessionButton).toBeVisible()

    const conversationsBox = await conversationsButton.boundingBox()
    const newSessionBox = await newSessionButton.boundingBox()
    expect(conversationsBox).not.toBeNull()
    expect(newSessionBox).not.toBeNull()
    expect(conversationsBox?.width ?? 0).toBeLessThanOrEqual(260)
    expect(
      (conversationsBox?.x ?? 0) + (conversationsBox?.width ?? 0)
    ).toBeLessThanOrEqual(newSessionBox?.x ?? 0)
    expect(
      (newSessionBox?.x ?? 0) -
        ((conversationsBox?.x ?? 0) + (conversationsBox?.width ?? 0))
    ).toBeLessThanOrEqual(12)

    const newSessionText = newSessionButton.getByText("New session", {
      exact: true,
    })
    if (await newSessionText.isVisible()) {
      expect(
        (await newSessionText.boundingBox())?.height ?? 0
      ).toBeLessThanOrEqual(20)
    } else {
      expect(newSessionBox?.width ?? 0).toBeLessThanOrEqual(48)
    }
  })

  test("collapses New session to icon-only on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const newSessionButton = page.locator('[aria-label="New session"]')
    await expect(newSessionButton).toBeVisible()
    await expect(
      newSessionButton.getByText("New session", { exact: true })
    ).not.toBeVisible()
  })

  test("opens Pi resources as a docked canvas", async ({ page }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    let workspaceTreeRequests = 0
    page.on("request", (request) => {
      if (request.url() === "http://localhost:3000/api/workspace/tree") {
        workspaceTreeRequests += 1
      }
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")
    expect(workspaceTreeRequests).toBe(0)

    const resourcesButton = page.locator('[aria-label="Pi resources"]')
    await expect(resourcesButton).toBeVisible()
    await resourcesButton.click()
    await expect.poll(() => workspaceTreeRequests).toBe(1)

    const chatColumn = page.locator('[data-testid="chat-column"]')
    const canvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(canvas).toBeVisible()

    const chatBox = await chatColumn.boundingBox()
    const canvasBox = await canvas.boundingBox()
    const viewport = page.viewportSize()
    expect(chatBox).not.toBeNull()
    expect(canvasBox).not.toBeNull()
    expect(canvasBox?.x).toBeGreaterThanOrEqual(
      (chatBox?.x ?? 0) + (chatBox?.width ?? 0) - 1
    )
    expect(canvasBox?.width).toBeGreaterThanOrEqual(
      Math.floor((viewport?.width ?? 0) * 0.7) - 1
    )

    await expect(canvas.getByText("Pi Resources")).toBeVisible()
    await expect(
      page.locator('[data-testid="right-panel-floating-launcher"]')
    ).not.toBeVisible()
    const headerLauncher = canvas.locator(
      '[data-testid="right-panel-header-launcher"]'
    )
    await expect(headerLauncher).toBeVisible()
    await expect(
      headerLauncher.getByRole("button", { name: "Pi resources" })
    ).toContainText(/\d+/)
    await expect(
      canvas.getByTestId("resource-chip-section-skills")
    ).toBeVisible()
    await expect(
      canvas.getByTestId("resource-chip-section-extensions")
    ).toBeVisible()
    await expect(
      canvas.getByTestId("resource-chip-section-prompts")
    ).toBeVisible()
    await expect(
      canvas.getByTestId("resource-chip-section-packages")
    ).toBeVisible()
    await expect(
      canvas.getByTestId("resource-chip-section-context")
    ).toBeVisible()
    await expect(
      canvas.getByTestId("resource-chip-section-diagnostics")
    ).toBeVisible()
    await expect(canvas.getByText("Skills", { exact: true })).toBeVisible()
    await expect(canvas.getByText("Prompts", { exact: true })).toBeVisible()
    await expect(canvas.getByText("Extensions", { exact: true })).toBeVisible()
    await expect(canvas.getByText("Packages", { exact: true })).toBeVisible()
    await expect(canvas.getByText("Context", { exact: true })).toBeVisible()
    const skillsSection = canvas.getByTestId("resource-chip-section-skills")
    const skillItems = skillsSection.getByTestId("resource-chip")
    await expect(skillItems).toHaveCount(6)
    await expect(
      skillsSection.getByText("frontend-helper", { exact: true })
    ).toBeVisible()
    await expect(
      skillsSection.getByText("codebase-research", { exact: true })
    ).toBeVisible()
    await expect(
      skillsSection.getByText("doc-gardening", { exact: true })
    ).toBeVisible()
    await expect(
      skillsSection.getByText("execution-plan", { exact: true })
    ).toBeVisible()
    await expect(
      skillsSection.getByText("frontend-design", { exact: true })
    ).toBeVisible()
    await expect(
      skillsSection.getByText("memory-synthesis", { exact: true })
    ).toBeVisible()
    await expect(
      skillsSection.getByText("active", { exact: true })
    ).toBeVisible()
    await expect(
      skillsSection.getByText("chat-runtime-debugging", { exact: true })
    ).toHaveCount(0)
    const firstSkillBox = await skillItems.nth(0).boundingBox()
    const secondSkillBox = await skillItems.nth(1).boundingBox()
    const skillsLabelBox = await canvas
      .getByText("Skills", { exact: true })
      .boundingBox()
    expect(firstSkillBox).not.toBeNull()
    expect(secondSkillBox).not.toBeNull()
    expect(skillsLabelBox).not.toBeNull()
    expect(skillsLabelBox?.y ?? 0).toBeLessThan(firstSkillBox?.y ?? 0)
    expect(
      Math.abs((firstSkillBox?.x ?? 0) - (secondSkillBox?.x ?? 0))
    ).toBeLessThanOrEqual(24)
    expect(secondSkillBox?.y ?? 0).toBeGreaterThan(firstSkillBox?.y ?? 0)
    const projectInventoryChip = canvas.getByRole("listitem", {
      name: /project-inventory/,
    })
    await expect(projectInventoryChip).toBeVisible()
    const extensionsSection = canvas.getByTestId(
      "resource-chip-section-extensions"
    )
    const firstExtensionBox = await extensionsSection
      .getByTestId("resource-chip")
      .first()
      .boundingBox()
    const extensionsLabelBox = await canvas
      .getByText("Extensions", { exact: true })
      .boundingBox()
    expect(firstExtensionBox).not.toBeNull()
    expect(extensionsLabelBox).not.toBeNull()
    expect(extensionsLabelBox?.y ?? 0).toBeLessThan(firstExtensionBox?.y ?? 0)
    await expect(
      canvas.getByText("project-inventory", { exact: true })
    ).toBeVisible()
    await expect(canvas.getByText("live-tool", { exact: true })).toBeVisible()
    await expect(canvas.getByText("draft-tool", { exact: true })).toBeVisible()
    await expect(canvas.getByText("staged", { exact: true })).toBeVisible()
    await expect(
      canvas.getByText(".pi/extensions/project-inventory.ts", { exact: true })
    ).toHaveCount(0)
    await expect(
      canvas.getByText("pi-autoresearch", { exact: true })
    ).toBeVisible()
    await expect(
      canvas.getByText("pi-skill-palette", { exact: true })
    ).toBeVisible()
    await expect(
      canvas.getByText("pi-autocontext", { exact: true })
    ).toBeVisible()
    await expect(canvas.getByText("filechanges", { exact: true })).toBeVisible()
    await expect(canvas.getByText("subagents", { exact: true })).toBeVisible()
    await expect(canvas.getByText("daily-brief", { exact: true })).toBeVisible()
    await expect(
      canvas.getByText("example-package", { exact: true })
    ).toBeVisible()
    await expect(
      canvas.getByText("reload-required", { exact: true })
    ).toBeVisible()
    await expect(canvas.getByText("AGENTS.md", { exact: true })).toBeVisible()
    await expect(canvas.getByText("/tmp/fleet-pi/AGENTS.md")).toHaveCount(0)
    await expect(
      canvas.getByRole("listitem", { name: /needs a reload/i })
    ).toBeVisible()
  })

  test("resizes chat content when a side panel opens near desktop width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1013, height: 938 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.locator('[aria-label="Pi resources"]').click()

    const canvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(canvas).toBeVisible()
    await expect(
      page.locator('[data-testid="pi-resources-mobile-panel"]')
    ).not.toBeVisible()

    const chatColumn = page.locator('[data-testid="chat-column"]')
    const input = page.getByPlaceholder("Send a message...")
    const suggestion = page.getByRole("button", {
      name: "Summarize this project",
    })

    const chatBox = await chatColumn.boundingBox()
    const canvasBox = await canvas.boundingBox()
    const inputBox = await input.boundingBox()
    const suggestionBox = await suggestion.boundingBox()

    expect(chatBox).not.toBeNull()
    expect(canvasBox).not.toBeNull()
    expect(inputBox).not.toBeNull()
    expect(suggestionBox).not.toBeNull()
    const canvasLeft = canvasBox?.x ?? 0
    expect((chatBox?.x ?? 0) + (chatBox?.width ?? 0)).toBeLessThanOrEqual(
      canvasLeft + 1
    )
    expect((inputBox?.x ?? 0) + (inputBox?.width ?? 0)).toBeLessThanOrEqual(
      canvasLeft + 1
    )
    expect(
      (suggestionBox?.x ?? 0) + (suggestionBox?.width ?? 0)
    ).toBeLessThanOrEqual(canvasLeft + 1)
  })

  test("shows the agent workspace filesystem tab", async ({ page }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.locator('[aria-label="Pi resources"]').click()

    const resourcesCanvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(resourcesCanvas).toBeVisible()
    await page.getByRole("button", { name: "Workspace", exact: true }).click()

    const workspaceCanvas = page.locator('[data-testid="pi-workspace-canvas"]')
    await expect(workspaceCanvas).toBeVisible()
    const workspaceTree = workspaceCanvas.locator(
      '[data-testid="workspace-tree"]'
    )
    await expect(workspaceTree).toBeVisible()
    await expect(workspaceTree.getByText("agent-workspace")).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "memory", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "pi", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "policies", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "scratch", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "identity.md", exact: true })
    ).toHaveCount(0)
    await expect(
      workspaceTree.getByRole("button", { name: "factory.md", exact: true })
    ).toHaveCount(0)

    await expandWorkspacePath(workspaceTree, ["memory", "research"])
    await expect(
      workspaceTree.getByRole("button", { name: "factory.md", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "hermes.md", exact: true })
    ).toBeVisible()

    await expandWorkspacePath(workspaceTree, ["policies"])
    await expect(
      workspaceTree.getByRole("button", {
        name: "workspace-policy.md",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", {
        name: "constraints.md",
        exact: true,
      })
    ).toBeVisible()

    await expandWorkspacePath(workspaceTree, ["scratch", "tmp"])
    await expect(
      workspaceTree.getByRole("button", { name: ".gitkeep", exact: true })
    ).toBeVisible()

    await workspaceTree.getByRole("button", { name: "factory.md" }).click()
    const workspacePreview = workspaceCanvas.locator(
      '[data-testid="workspace-preview"]'
    )
    await expect(workspacePreview).toBeVisible()
    await expect(
      workspacePreview.getByText("factory.md", { exact: true })
    ).toBeVisible()
    await expect(
      workspacePreview.getByRole("heading", { name: "Factory" })
    ).toBeVisible()
    await expect(
      workspacePreview.getByText("Purpose: Research notes for Factory.")
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "factory.md" })
    ).toHaveAttribute("aria-pressed", "true")
    await workspaceTree.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(
      workspaceTree.getByText("Diagnostics", { exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("listitem", {
        name: /pending reindex/i,
      })
    ).toBeVisible()

    await page.getByRole("button", { name: "Pi resources" }).click()
    await expect(
      resourcesCanvas.getByText("codebase-research", { exact: true })
    ).toBeVisible()
  })

  test("keeps diagnostics visible while workspace browsing and chat stay usable", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)
    await mockChatStream(page, {
      assistantText: "Diagnostics do not block chat.",
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.locator('[aria-label="Pi resources"]').click()
    const resourcesCanvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(resourcesCanvas).toBeVisible()
    await expect(
      resourcesCanvas.getByTestId("resource-chip-section-diagnostics")
    ).toBeVisible()
    await expect(
      resourcesCanvas.getByRole("listitem", { name: /needs a reload/i })
    ).toBeVisible()

    await page.getByRole("button", { name: "Workspace", exact: true }).click()
    const workspaceCanvas = page.locator('[data-testid="pi-workspace-canvas"]')
    await expect(workspaceCanvas).toBeVisible()
    const workspaceTree = workspaceCanvas.locator(
      '[data-testid="workspace-tree"]'
    )
    await expandWorkspacePath(workspaceTree, ["memory", "research"])
    await workspaceTree.getByRole("button", { name: "factory.md" }).click()

    const preview = workspaceCanvas.locator('[data-testid="workspace-preview"]')
    await expect(
      preview.getByRole("heading", { name: "Factory" })
    ).toBeVisible()
    await expect(
      workspaceCanvas.getByText("Diagnostics", { exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("listitem", { name: /pending reindex/i })
    ).toBeVisible()

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await expect(textarea).toBeVisible()
    await textarea.fill("Can you still help?")
    await page.keyboard.press("Enter")

    await expect(page.locator("text=Can you still help?").first()).toBeVisible()
    await expect(
      page.locator("text=Diagnostics do not block chat.")
    ).toBeVisible({ timeout: 10000 })
  })

  test("clears stale workspace previews for degraded responses and refresh removals", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page, [
      MOCK_WORKSPACE_TREE,
      MOCK_WORKSPACE_TREE_WITHOUT_FACTORY,
    ])
    await mockWorkspaceFile(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Workspace", exact: true }).click()

    const workspaceCanvas = page.locator('[data-testid="pi-workspace-canvas"]')
    await expect(workspaceCanvas).toBeVisible()
    const workspaceTree = workspaceCanvas.locator(
      '[data-testid="workspace-tree"]'
    )
    const preview = workspaceCanvas.locator('[data-testid="workspace-preview"]')

    await expandWorkspacePath(workspaceTree, ["memory", "research"])
    await workspaceTree.getByRole("button", { name: "factory.md" }).click()
    await expect(
      preview.getByRole("heading", { name: "Factory" })
    ).toBeVisible()

    await expandWorkspacePath(workspaceTree, ["artifacts", "reports"])
    await workspaceTree.getByRole("button", { name: "large-report.md" }).click()
    await expect(preview.getByText("Preview too large")).toBeVisible()
    await expect(preview.getByRole("heading", { name: "Factory" })).toHaveCount(
      0
    )

    await workspaceTree
      .getByRole("button", { name: "binary-report.bin" })
      .click()
    await expect(preview.getByText("Unsupported preview")).toBeVisible()
    await expect(preview.getByRole("heading", { name: "Factory" })).toHaveCount(
      0
    )

    await workspaceTree.getByRole("button", { name: "broken.md" }).click()
    await expect(preview.getByText("Unable to load preview")).toBeVisible()
    await expect(
      preview.getByText("Workspace preview is temporarily unavailable.")
    ).toBeVisible()
    await expect(preview.getByRole("heading", { name: "Factory" })).toHaveCount(
      0
    )

    await workspaceTree.getByRole("button", { name: "factory.md" }).click()
    await expect(
      preview.getByRole("heading", { name: "Factory" })
    ).toBeVisible()
    await workspaceCanvas
      .getByRole("button", { name: "Refresh Workspace" })
      .click()

    await expect(
      workspaceTree.getByRole("button", { name: "factory.md", exact: true })
    ).toHaveCount(0)
    await expect(preview.getByText("Select a file")).toBeVisible()
    await expect(preview.getByRole("heading", { name: "Factory" })).toHaveCount(
      0
    )
  })

  test("shows configurations and applies theme preference", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.locator('[aria-label="Pi resources"]').click()

    const resourcesCanvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(resourcesCanvas).toBeVisible()
    await page
      .getByRole("button", { name: "Configurations", exact: true })
      .click()

    const configCanvas = page.locator('[data-testid="pi-config-canvas"]')
    await expect(configCanvas).toBeVisible()
    await expect(
      page.locator('[data-testid="right-panel-floating-launcher"]')
    ).not.toBeVisible()
    const headerLauncher = configCanvas.locator(
      '[data-testid="right-panel-header-launcher"]'
    )
    await expect(headerLauncher).toBeVisible()
    await expect(
      headerLauncher.getByRole("button", { name: "Pi resources" })
    ).toContainText(/\d+/)
    await expect(
      headerLauncher.getByRole("button", { name: "Configurations" })
    ).toContainText("Configurations")
    const configurations = configCanvas.locator(
      '[data-testid="configurations-tab"]'
    )
    await expect(configurations).toBeVisible()
    await expect(
      configurations.getByText("Tools", { exact: true })
    ).toBeVisible()
    await expect(
      configurations.getByText("Resources", { exact: true })
    ).toBeVisible()
    await expect(
      configurations.getByText("LLM Providers", { exact: true })
    ).toBeVisible()
    await expect(
      configurations.getByText("Runtime Models", { exact: true })
    ).toBeVisible()
    await expect(
      configurations.getByText("Personalization", { exact: true })
    ).toBeVisible()
    await expect(
      configurations.getByText("Claude Sonnet 4.6", { exact: true })
    ).toBeVisible()
    await expect(
      configurations.getByText("Claude Opus 4.6", { exact: true })
    ).toBeVisible()
    await expect(configurations.getByTestId("runtime-models-list")).toHaveCSS(
      "overflow-y",
      "auto"
    )
    await expect(configurations.getByTestId("runtime-models-list")).toHaveCSS(
      "max-height",
      "400px"
    )

    await configurations.getByRole("button", { name: "Dark" }).click()
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.classList.contains("dark"))
      )
      .toBe(true)

    await configurations.getByRole("button", { name: "Light" }).click()
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.classList.contains("dark"))
      )
      .toBe(false)

    await headerLauncher.getByRole("button", { name: "Pi resources" }).click()
    await expect(
      resourcesCanvas.getByText("codebase-research", { exact: true })
    ).toBeVisible()
    await resourcesCanvas
      .locator('[data-testid="right-panel-header-launcher"]')
      .getByRole("button", { name: "Workspace", exact: true })
      .click()
    await expect(
      page.locator(
        '[data-testid="pi-workspace-canvas"] [data-testid="workspace-tree"]'
      )
    ).toBeVisible()
  })

  test("resizes and persists the Pi resources canvas", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 820 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.locator('[aria-label="Pi resources"]').click()

    const canvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(canvas).toBeVisible()

    const before = await canvas.boundingBox()
    const handle = page.locator('[data-testid="pi-resources-resize-handle"]')
    const handleBox = await handle.boundingBox()
    const startX = (handleBox?.x ?? 0) + (handleBox?.width ?? 0) / 2
    const startY = (handleBox?.y ?? 0) + 80

    await handle.dispatchEvent("pointerdown", {
      bubbles: true,
      clientX: startX,
      clientY: startY,
    })
    await page.evaluate(
      ({ clientX, clientY }) => {
        window.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX,
            clientY,
          })
        )
      },
      { clientX: startX + 300, clientY: startY }
    )
    await page.evaluate(
      ({ clientX, clientY }) => {
        window.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            clientX,
            clientY,
          })
        )
      },
      { clientX: startX + 300, clientY: startY }
    )

    await expect
      .poll(async () => (await canvas.boundingBox())?.width ?? 0)
      .toBeLessThan((before?.width ?? 0) - 120)

    const storedWidth = await page.evaluate(() =>
      window.localStorage.getItem("fleet-pi-resource-canvas-width")
    )
    expect(Number(storedWidth)).toBeLessThan((before?.width ?? 0) - 120)

    const resized = await canvas.boundingBox()
    const resizedHandleBox = await handle.boundingBox()
    const resizedStartX =
      (resizedHandleBox?.x ?? 0) + (resizedHandleBox?.width ?? 0) / 2
    const resizedStartY = (resizedHandleBox?.y ?? 0) + 80

    await handle.dispatchEvent("pointerdown", {
      bubbles: true,
      clientX: resizedStartX,
      clientY: resizedStartY,
    })
    await page.evaluate(
      ({ clientX, clientY }) => {
        window.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX,
            clientY,
          })
        )
      },
      { clientX: resizedStartX - 500, clientY: resizedStartY }
    )
    await page.evaluate(
      ({ clientX, clientY }) => {
        window.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            clientX,
            clientY,
          })
        )
      },
      { clientX: resizedStartX - 500, clientY: resizedStartY }
    )

    await expect
      .poll(async () => (await canvas.boundingBox())?.width ?? 0)
      .toBeGreaterThan((resized?.width ?? 0) + 120)
    expect((await canvas.boundingBox())?.width ?? 0).toBeLessThanOrEqual(841)
  })

  test("opens Pi resources as a mobile overlay", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.locator('[aria-label="Pi resources"]').click()

    await expect(
      page.locator('[data-testid="pi-resources-canvas"]')
    ).not.toBeVisible()
    const mobilePanel = page.locator(
      '[data-testid="pi-resources-mobile-panel"]'
    )
    await expect(mobilePanel).toBeVisible()
    await expect(
      mobilePanel.getByText("codebase-research", { exact: true })
    ).toBeVisible()
  })

  test("scrolls Pi resources mobile overlay at tablet height", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 914, height: 698 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.locator('[aria-label="Pi resources"]').click()

    const mobilePanel = page.locator(
      '[data-testid="pi-resources-mobile-panel"]'
    )
    await expect(mobilePanel).toBeVisible()
    await scrollPanelToEnd(mobilePanel)
    await expect(
      mobilePanel.getByText("AGENTS.md", { exact: true })
    ).toBeVisible()
  })

  test("scrolls configurations mobile overlay at tablet height", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 914, height: 698 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page
      .getByRole("button", { name: "Configurations", exact: true })
      .click()

    const mobilePanel = page.locator('[data-testid="pi-config-mobile-panel"]')
    await expect(mobilePanel).toBeVisible()
    await scrollPanelToEnd(mobilePanel)
    await expect(
      mobilePanel.getByRole("button", { name: "System" })
    ).toBeVisible()
  })

  test("shows workspace preview after mobile file selection", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Workspace", exact: true }).click()

    const mobilePanel = page.locator(
      '[data-testid="pi-workspace-mobile-panel"]'
    )
    await expect(mobilePanel).toBeVisible()
    await expandWorkspacePath(mobilePanel, ["memory", "research"])
    await mobilePanel.getByRole("button", { name: "factory.md" }).click()

    const preview = mobilePanel.locator('[data-testid="workspace-preview"]')
    await expect(
      preview.getByRole("heading", { name: "Factory" })
    ).toBeVisible()
    await expect(
      preview.getByText("Purpose: Research notes for Factory.")
    ).toBeVisible()
  })

  test("switches to Plan mode and shows numbered Plan output", async ({
    page,
  }) => {
    const planText =
      "Plan:\n1. Analyze the codebase structure\n2. Identify key components\n3. Propose improvements"

    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockChatStream(page, {
      assistantText: planText,
      planMode: true,
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const modeSelector = page.locator('[aria-label="Select mode"]')
    await expect(modeSelector).toBeVisible()

    await expect(modeSelector).toContainText("Agent")

    await modeSelector.click()

    const popover = page.locator('[role="dialog"]')
    await expect(popover).toBeVisible()

    const planOption = popover.locator("text=Plan").first()
    await expect(planOption).toBeVisible()
    await planOption.click()

    await expect(popover).not.toBeVisible()

    await expect(modeSelector).toContainText("Plan")

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await expect(textarea).toBeVisible()
    await textarea.click()
    await textarea.fill("Create a plan for this project")
    await page.keyboard.press("Enter")

    await expect(
      page.locator("text=Create a plan for this project").first()
    ).toBeVisible()

    await expect(page.locator("text=Plan:").first()).toBeVisible({
      timeout: 10000,
    })

    await expect(
      page.locator("text=Analyze the codebase structure").first()
    ).toBeVisible({ timeout: 10000 })

    const writeTool = page.locator("text=tool-Write").first()
    await expect(writeTool).not.toBeVisible()

    const editTool = page.locator("text=tool-Edit").first()
    await expect(editTool).not.toBeVisible()
  })
})
