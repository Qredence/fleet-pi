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

  test("switches to Plan mode and shows numbered Plan output", async ({
    page,
  }) => {
    const planText =
      "Plan:\n1. Analyze the codebase structure\n2. Identify key components\n3. Propose improvements"

    await mockChatModels(page)
    await mockChatSessions(page)
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
