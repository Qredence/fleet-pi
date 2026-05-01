import { expect, test } from "@playwright/test"
import type { Page, Route } from "@playwright/test"

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

const MOCK_RESOURCES = {
  skills: [
    {
      name: "fleet-pi-orientation",
      description: "Map the Fleet Pi codebase before planning or editing.",
      path: "/tmp/fleet-pi/.pi/skills/fleet-pi-orientation/SKILL.md",
      source: "project",
    },
  ],
  prompts: [],
  extensions: [
    {
      name: ".pi/extensions/project-inventory.ts",
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
  agentsFiles: [],
  diagnostics: [],
}

const MOCK_WORKSPACE_TREE = {
  root: "agent-workspace",
  nodes: [
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
          name: "research",
          path: "agent-workspace/memory/research",
          type: "directory",
          children: [
            {
              name: "factory.md",
              path: "agent-workspace/memory/research/factory.md",
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
              name: "skill.md",
              path: "agent-workspace/skills/codebase-research/skill.md",
              type: "file",
            },
          ],
        },
      ],
    },
  ],
  diagnostics: [],
}

const MOCK_WORKSPACE_FILES = new Map([
  [
    "agent-workspace/memory/research/factory.md",
    {
      path: "agent-workspace/memory/research/factory.md",
      name: "factory.md",
      content:
        "# Factory\n\nPurpose: Research notes for Factory.\n\nStatus: Seeded stub.\n",
      mediaType: "text/markdown",
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

function mockChatResources(page: Page) {
  return page.route(
    "http://localhost:3000/api/chat/resources",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESOURCES),
      })
    }
  )
}

function mockWorkspaceTree(page: Page) {
  return page.route(
    "http://localhost:3000/api/workspace/tree",
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_WORKSPACE_TREE),
      })
    }
  )
}

function mockWorkspaceFile(page: Page) {
  return page.route(
    "http://localhost:3000/api/workspace/file?**",
    async (route: Route) => {
      const url = new URL(route.request().url())
      const path = url.searchParams.get("path") ?? ""
      const file = MOCK_WORKSPACE_FILES.get(path)

      await route.fulfill({
        status: file ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(
          file ?? { message: `No mocked workspace file for ${path}` }
        ),
      })
    }
  )
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
  const text = options.assistantText ?? "Hello! How can I help you today?"
  const chunks = text.split(" ")

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
          total: 3,
          message: "Planning",
        })
      )
    }

    events.push(
      JSON.stringify({
        type: "done",
        message: {
          id: assistantId,
          role: "assistant",
          createdAt: Date.now(),
          parts: [{ type: "text", text }],
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

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await expect(textarea).toBeVisible()

    const newSessionButton = page.locator('[aria-label="New session"]')
    await expect(newSessionButton).toBeVisible()

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

    const newSessionButton = page.locator('[aria-label="New session"]')
    await expect(newSessionButton).toBeVisible()
    await newSessionButton.click()

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await expect(textarea).toBeVisible()

    await expect(page.locator("text=What can you do?")).toBeVisible()
    await expect(page.locator("text=Tell me about this project")).toBeVisible()
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

  test("opens Pi resources as a docked desktop canvas", async ({ page }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const resourcesButton = page.locator('[aria-label="Pi resources"]')
    await expect(resourcesButton).toBeVisible()
    await resourcesButton.click()

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
      canvas.getByText("fleet-pi-orientation", { exact: true })
    ).toBeVisible()
    await expect(
      canvas
        .locator("span")
        .filter({ hasText: ".pi/extensions/project-inventory.ts" })
        .first()
    ).toBeVisible()
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
  })

  test("shows the agent workspace filesystem tab", async ({ page }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.locator('[aria-label="Pi resources"]').click()

    const canvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(canvas).toBeVisible()
    await canvas.getByRole("button", { name: "Workspace", exact: true }).click()

    const workspaceTree = canvas.locator('[data-testid="workspace-tree"]')
    await expect(workspaceTree).toBeVisible()
    await expect(workspaceTree.getByText("agent-workspace")).toBeVisible()
    await expect(workspaceTree.getByText("identity.md")).toBeVisible()
    await expect(workspaceTree.getByText("2026-05-01.md")).toBeVisible()
    await expect(workspaceTree.getByText("hermes.md")).toBeVisible()
    await expect(workspaceTree.getByText("skill.md")).toBeVisible()

    await workspaceTree.getByRole("button", { name: "factory.md" }).click()
    const workspacePreview = canvas.locator('[data-testid="workspace-preview"]')
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

    await canvas.getByRole("button", { name: "Resources", exact: true }).click()
    await expect(
      canvas.getByText("fleet-pi-orientation", { exact: true })
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
    const handle = page.locator('[data-testid="pi-resources-resize-handle"]')
    await expect(canvas).toBeVisible()

    const before = await canvas.boundingBox()
    const handleBox = await handle.boundingBox()
    expect(before).not.toBeNull()
    expect(handleBox).not.toBeNull()
    expect(before?.width ?? 0).toBeGreaterThan(830)
    expect(before?.width ?? 0).toBeLessThanOrEqual(841)

    await page.mouse.move(
      (handleBox?.x ?? 0) + (handleBox?.width ?? 0) / 2,
      (handleBox?.y ?? 0) + 80
    )
    await page.mouse.down()
    await page.mouse.move((handleBox?.x ?? 0) + 160, (handleBox?.y ?? 0) + 80)
    await page.mouse.up()

    await expect
      .poll(async () => (await canvas.boundingBox())?.width ?? 0)
      .toBeLessThan((before?.width ?? 0) - 120)

    const storedWidth = await page.evaluate(() =>
      window.localStorage.getItem("fleet-pi-resource-canvas-width")
    )
    expect(Number(storedWidth)).toBeLessThan((before?.width ?? 0) - 120)

    const resized = await canvas.boundingBox()
    const resizedHandleBox = await handle.boundingBox()
    await page.mouse.move(
      (resizedHandleBox?.x ?? 0) + (resizedHandleBox?.width ?? 0) / 2,
      (resizedHandleBox?.y ?? 0) + 80
    )
    await page.mouse.down()
    await page.mouse.move(
      (resizedHandleBox?.x ?? 0) - 500,
      (resizedHandleBox?.y ?? 0) + 80
    )
    await page.mouse.up()

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
      mobilePanel.getByText("fleet-pi-orientation", { exact: true })
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
