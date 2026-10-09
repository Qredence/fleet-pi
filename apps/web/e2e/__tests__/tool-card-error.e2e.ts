import { expect, test } from "@playwright/test"
import type { Page, Route } from "@playwright/test"

const MOCK_SESSION_FILE = "/tmp/fleet-pi-tool-card-session.json"
const MOCK_SESSION_ID = "tool-card-session-id"

const MOCK_MODELS = {
  models: [
    {
      key: "mock-model-key",
      provider: "amazon-bedrock",
      id: "us.anthropic.claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      reasoning: true,
      input: ["text"],
      available: true,
    },
  ],
  selectedModelKey: "mock-model-key",
  diagnostics: [],
}

function seedSession(page: Page) {
  return page.addInitScript(
    ({ sessionFile, sessionId }) => {
      window.localStorage.setItem(
        "fleet-pi-chat-sessions",
        JSON.stringify({
          normal: { sessionFile, sessionId },
          harness: {},
        })
      )
    },
    { sessionFile: MOCK_SESSION_FILE, sessionId: MOCK_SESSION_ID }
  )
}

function mockChatModels(page: Page) {
  return page.route("**/api/chat/models", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_MODELS),
    })
  })
}

function mockChatSessions(page: Page) {
  return page.route("**/api/chat/sessions", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessions: [] }),
    })
  })
}

function mockChatResources(page: Page) {
  return page.route("**/api/chat/resources", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        packages: [],
        skills: [],
        prompts: [],
        extensions: [],
        themes: [],
        agentsFiles: [],
        diagnostics: [],
      }),
    })
  })
}

const ERROR_CARD_PART = {
  type: "tool-workspace_write",
  toolCallId: "tool-call-workspace-write-error",
  state: "output-error",
  input: {
    file_path: "agent-workspace/memory/project/decisions.md",
  },
  output: {
    content: "",
    details: { message: "Simulated write failure" },
  },
}

const RUNNING_CARD_PART = {
  type: "tool-workspace_write",
  toolCallId: "tool-call-workspace-write-running",
  state: "input-streaming",
  input: {
    file_path: "agent-workspace/plans/roadmap.md",
  },
}

const PROJECT_INVENTORY_PART = {
  type: "tool-project_inventory",
  toolCallId: "tool-call-project-inventory",
  state: "output-available",
  input: { focus: "all" },
  output: {
    content: "",
    details: {
      focus: "all",
      resources: [
        { dir: "../.pi/skills", entries: ["fleet-pi-orientation"] },
        { dir: "../.pi/prompts", entries: [] },
      ],
    },
  },
}

const MCP_PART = {
  type: "tool-mcp__postgres__query",
  toolCallId: "tool-call-mcp-query",
  state: "output-available",
  input: { query: "select 1" },
  output: { content: "rows: 1", details: {} },
}

function mockChatSessionWithParts(
  page: Page,
  toolParts: Array<Record<string, unknown>>
) {
  return page.route("**/api/chat/session?**", async (route: Route) => {
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
            createdAt: Date.now() - 2000,
            parts: [{ type: "text", text: "Run the workspace tools" }],
          },
          {
            id: "assistant-msg-1",
            role: "assistant",
            createdAt: Date.now() - 1000,
            parts: toolParts,
          },
        ],
      }),
    })
  })
}

async function setupToolCardPage(
  page: Page,
  toolParts: Array<Record<string, unknown>>
) {
  await seedSession(page)
  await mockChatModels(page)
  await mockChatSessions(page)
  await mockChatResources(page)
  await mockChatSessionWithParts(page, toolParts)

  await page.goto("/")
  await page.waitForLoadState("networkidle")

  await expect(
    page.locator("text=Run the workspace tools").first()
  ).toBeVisible({ timeout: 10000 })
}

function runtimeToolCard(text: string, page: Page) {
  return page
    .getByText(text, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-[12px]")][1]')
}

test("error-state workspace_write card renders fixed semantic classes", async ({
  page,
}, testInfo) => {
  await setupToolCardPage(page, [ERROR_CARD_PART])

  const card = runtimeToolCard("Failed to update agent-workspace", page)
  await expect(card).toBeVisible()
  await expect(card.getByText("Workspace write", { exact: true })).toBeVisible()
  await expect(card.getByText("Error", { exact: true })).toBeVisible()

  await expect(card).toHaveClass(/border-destructive\/30/)
  await expect(card).toHaveClass(/text-destructive-foreground/)
  await expect(card).toHaveClass(/dark:text-destructive/)
  await expect(card).not.toHaveClass(/text-rose-100/)
  await expect(card).not.toHaveClass(/text-sky-100/)
  expect(
    /text-rose-100|text-sky-100/.test((await card.getAttribute("class")) ?? "")
  ).toBe(false)

  await page.screenshot({
    path: testInfo.outputPath("workspaces-write-error-card.png"),
    fullPage: true,
  })
})

test("tool-project_inventory renders its custom card, not the generic fallback", async ({
  page,
}, testInfo) => {
  await setupToolCardPage(page, [PROJECT_INVENTORY_PART])

  await expect(
    page.getByText("Project inventory", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("2 resource roots scanned")).toBeVisible()

  // The generic fallback would render the raw tool name `project_inventory`.
  await expect(
    page.getByText("project_inventory", { exact: true })
  ).toHaveCount(0)
  await expect(page.locator(".an-tool-mcp")).toHaveCount(0)

  await page.screenshot({
    path: testInfo.outputPath("project-inventory-custom-card.png"),
    fullPage: true,
  })
})

test("tool-mcp__* part still renders generically", async ({
  page,
}, testInfo) => {
  await setupToolCardPage(page, [MCP_PART])

  const mcpCard = page.locator(".an-tool-mcp")
  await expect(mcpCard).toHaveCount(1)
  await expect(mcpCard).toContainText("Queried")

  // The MCP part must not surface as a fleet-pi RuntimeToolCard.
  await expect(
    page.getByText("Project inventory", { exact: true })
  ).toHaveCount(0)
  await expect(page.getByText("Workspace write", { exact: true })).toHaveCount(
    0
  )

  await page.screenshot({
    path: testInfo.outputPath("mcp-part-generic.png"),
    fullPage: true,
  })
})

test("pending workspace_write card renders the semantic info tone", async ({
  page,
}, testInfo) => {
  await setupToolCardPage(page, [RUNNING_CARD_PART])

  const card = runtimeToolCard("Running", page)
  await expect(card).toBeVisible()
  await expect(card.getByText("Workspace write", { exact: true })).toBeVisible()

  await expect(card).toHaveClass(/border-info\/30/)
  await expect(card).toHaveClass(/text-info-foreground/)
  await expect(card).toHaveClass(/dark:text-info/)
  await expect(card).not.toHaveClass(/text-sky-100/)
  await expect(card).not.toHaveClass(/rose/)

  await page.screenshot({
    path: testInfo.outputPath("workspaces-write-running-card.png"),
    fullPage: true,
  })
})
