import { expect, test } from "@playwright/test"
import {
  mockChatModels,
  mockChatResources,
  mockChatSessions,
  mockChatStream,
} from "./chat-flows-support"

test.describe("chat plan", () => {
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
