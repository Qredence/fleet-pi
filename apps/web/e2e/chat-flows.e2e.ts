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

const MOCK_RESOURCES = {
  skills: [
    {
      name: "fleet-pi-orientation",
      description: "Map the Fleet Pi codebase before planning or editing.",
      path: "/tmp/fleet-pi/.pi/skills/fleet-pi-orientation/SKILL.md",
      source: "project",
    },
    {
      name: "agent-elements",
      description:
        "Build or inspect chat UI surfaces and interaction patterns.",
      path: "/tmp/fleet-pi/.pi/skills/agent-elements/SKILL.md",
      source: "project",
    },
    {
      name: "chat-runtime-debugging",
      description: "Troubleshoot streaming sessions and runtime state.",
      path: "/tmp/fleet-pi/.pi/skills/chat-runtime-debugging/SKILL.md",
      source: "project",
    },
  ],
  prompts: [],
  extensions: [
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
      canvas.getByTestId("resource-chip-section-context")
    ).toBeVisible()
    await expect(canvas.getByText("Skills", { exact: true })).toBeVisible()
    await expect(canvas.getByText("Extensions", { exact: true })).toBeVisible()
    await expect(canvas.getByText("Context", { exact: true })).toBeVisible()
    const skillsSection = canvas.getByTestId("resource-chip-section-skills")
    const skillItems = skillsSection.getByTestId("resource-chip")
    await expect(skillItems).toHaveCount(5)
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
      skillsSection.getByText("fleet-pi-orientation", { exact: true })
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
    ).toBeLessThanOrEqual(20)
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
    await expect(canvas.getByText("AGENTS.md", { exact: true })).toBeVisible()
    await expect(canvas.getByText("/tmp/fleet-pi/AGENTS.md")).toHaveCount(0)
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
    await expect(workspaceTree.getByText("identity.md")).toBeVisible()
    await expect(workspaceTree.getByText("2026-05-01.md")).toBeVisible()
    await expect(workspaceTree.getByText("hermes.md")).toBeVisible()
    await expect(workspaceTree.getByText("SKILL.md")).toHaveCount(5)

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

    await page.getByRole("button", { name: "Pi resources" }).click()
    await expect(
      resourcesCanvas.getByText("codebase-research", { exact: true })
    ).toBeVisible()
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
      configurations.getByText("Connectors", { exact: true })
    ).toBeVisible()
    await expect(
      configurations.getByText("LLM Providers", { exact: true })
    ).toBeVisible()
    await expect(
      configurations.getByText("Allowed Models", { exact: true })
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
    await expect(configurations.getByTestId("allowed-models-list")).toHaveCSS(
      "overflow-y",
      "auto"
    )
    await expect(configurations.getByTestId("allowed-models-list")).toHaveCSS(
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
