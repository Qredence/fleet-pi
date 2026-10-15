import { expect, test } from "@playwright/test"
import {
  MOCK_SESSION_FILE,
  MOCK_SESSION_ID,
  mockChatModels,
  mockChatNew,
  mockChatResources,
  mockChatSession,
  mockChatSessions,
  mockChatSettings,
  mockChatStream,
  mockPendingChatSession,
  mockWorkspaceTree,
} from "./chat-flows-support"

test.describe("chat session", () => {
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
    await expect(newSessionButton).not.toContainText("New session")

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
    await mockChatSettings(page)
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

    await page.getByRole("tab", { name: "Pi Resources" }).click()
    await expect(
      page.locator('[data-testid="pi-resources-canvas"]')
    ).toBeVisible()
    await page.getByRole("tab", { name: "Workspace", exact: true }).click()
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
          window.localStorage.getItem("fleet-pi-chat-sessions")
        )
      )
      .not.toBe(null)

    const storedSession = await page.evaluate(() => {
      const raw = window.localStorage.getItem("fleet-pi-chat-sessions")
      if (!raw) return null
      const parsed = JSON.parse(raw) as {
        normal?: { sessionFile?: string; sessionId?: string }
      }
      return parsed.normal ?? null
    })

    expect(storedSession).toMatchObject({
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

    await expect(page.getByRole("button", { name: "Stop" })).not.toBeVisible()
    await textarea.fill("Follow up after done")
    await page.keyboard.press("Enter")
    await expect(
      page.locator("text=Follow up after done").first()
    ).toBeVisible()
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

  test("hydrates a pending session without tripping the UI error boundary", async ({
    page,
  }) => {
    await page.addInitScript(
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

    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockPendingChatSession(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("text=Continue the pending task").first()
    ).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator("text=Processing...")).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator("text=Something went wrong")).toHaveCount(0)
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
    await expect(page.getByTestId("chat-shell")).toBeVisible()

    const workspaceTab = page.getByRole("tab", {
      name: "Workspace",
      exact: true,
    })
    await expect(workspaceTab).toBeVisible()
    await expect(workspaceTab).toBeEnabled()
    await workspaceTab.click()
    await expect(
      page.locator('[data-testid="pi-workspace-canvas"]')
    ).toBeVisible()
    await expect(
      page.locator(
        '[data-testid="pi-workspace-canvas"] [data-testid="workspace-tree"]'
      )
    ).toBeVisible()

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

    await expect(
      newSessionButton.getByText("New session", { exact: true })
    ).toHaveCount(0)
    expect(newSessionBox?.width ?? 0).toBeLessThanOrEqual(48)
  })

  test("keeps New session icon-only on mobile", async ({ page }) => {
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
})
