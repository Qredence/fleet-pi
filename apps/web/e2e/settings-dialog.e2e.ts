import { expect, test } from "@playwright/test"

test.describe("Settings Dialog E2E Tests", () => {
  // Shared API mocks to prevent flakiness from real API state
  test.beforeEach(async ({ page }) => {
    // Mock /api/chat/models
    await page.route(
      (url) => url.pathname.startsWith("/api/chat/models"),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            models: [
              {
                key: "google/gemini-3.5-flash",
                provider: "google",
                id: "gemini-3.5-flash",
                name: "Gemini 3.5 Flash",
                reasoning: false,
                input: ["text"],
                available: true,
              },
            ],
            selectedModelKey: "google/gemini-3.5-flash",
            diagnostics: [],
          }),
        })
      }
    )

    // Mock /api/chat/sessions
    await page.route(
      (url) => url.pathname.startsWith("/api/chat/sessions"),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [] }),
        })
      }
    )

    // Mock /api/chat/resources
    await page.route(
      (url) => url.pathname.startsWith("/api/chat/resources"),
      async (route) => {
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
      }
    )

    // Navigate to the main chat page
    await page.goto("/")
    // Wait for network idle to ensure event handlers have fully hydrated
    await page.waitForLoadState("networkidle")
    await expect(page.locator("body")).toBeVisible()
  })

  test("should open the account menu and then the settings dialog", async ({
    page,
  }) => {
    // 1. Locate and click the account menu button to open the popover
    const accountBtn = page.locator('[aria-label="Open account menu"]')
    await expect(accountBtn).toBeVisible()
    await accountBtn.click()

    // 2. Wait for the account menu popover (which has role="dialog") to mount and become visible
    const popover = page.locator('[role="dialog"]').first()
    await expect(popover).toBeVisible()

    // 3. Select and click the 'Settings' option from the popover
    const settingsMenuBtn = popover.getByRole("button", { name: "Settings" })
    await expect(settingsMenuBtn).toBeVisible()
    await settingsMenuBtn.click()

    // 4. Confirm that the settings dialog (with role="dialog" and name="Settings") is open and visible
    const settingsDialog = page.getByRole("dialog", { name: "Settings" })
    await expect(settingsDialog).toBeVisible()

    // 5. Verify all major sections/tabs are visible in the settings sidebar
    const appearanceTab = settingsDialog.getByRole("button", {
      name: /Appearance/,
    })
    const sandboxTab = settingsDialog.getByRole("button", { name: /Sandbox/ })
    const llmModelsTab = settingsDialog.getByRole("button", {
      name: /LLM Models/,
    })
    const piHarnessTab = settingsDialog.getByRole("button", {
      name: /Pi Harness/,
    })

    await expect(appearanceTab).toBeVisible()
    await expect(sandboxTab).toBeVisible()
    await expect(llmModelsTab).toBeVisible()
    await expect(piHarnessTab).toBeVisible()
  })

  test("should navigate through all settings sections successfully", async ({
    page,
  }) => {
    // Open Settings dialog
    await page.locator('[aria-label="Open account menu"]').click()
    const popover = page.locator('[role="dialog"]').first()
    await expect(popover).toBeVisible()
    await popover.getByRole("button", { name: "Settings" }).click()

    const settingsDialog = page.getByRole("dialog", { name: "Settings" })
    await expect(settingsDialog).toBeVisible()

    // Test Tab 1: Appearance (Default or Selected)
    await settingsDialog.getByRole("button", { name: /Appearance/ }).click()
    await expect(
      settingsDialog.getByRole("heading", { name: "Appearance", exact: true })
    ).toBeVisible()
    await expect(
      settingsDialog.getByText("Customize the look and feel of the interface.")
    ).toBeVisible()

    // Test Tab 2: Sandbox
    await settingsDialog
      .getByRole("button", { name: "Sandbox", exact: true })
      .click()
    await expect(
      settingsDialog.getByRole("heading", {
        name: "Sandbox",
        exact: true,
      })
    ).toBeVisible()

    // Test Tab 3: LLM Models
    await settingsDialog
      .getByRole("button", { name: "LLM Models", exact: true })
      .click()
    await expect(
      settingsDialog.getByRole("heading", { name: "LLM Models", exact: true })
    ).toBeVisible()

    // Test Tab 4: Pi Harness
    await settingsDialog.getByRole("button", { name: /Pi Harness/ }).click()
    await expect(
      settingsDialog.getByRole("heading", { name: "Pi Harness", exact: true })
    ).toBeVisible()
  })

  test("should allow interacting with appearance theme customizer", async ({
    page,
  }) => {
    // Open Settings dialog
    await page.locator('[aria-label="Open account menu"]').click()
    const popover = page.locator('[role="dialog"]').first()
    await expect(popover).toBeVisible()
    await popover.getByRole("button", { name: "Settings" }).click()

    const settingsDialog = page.getByRole("dialog", { name: "Settings" })
    await expect(settingsDialog).toBeVisible()

    // Make sure we are on Appearance tab
    await settingsDialog.getByRole("button", { name: /Appearance/ }).click()

    // The theme customizer is a Select control labeled "Theme" with
    // System / Light / Dark options (Base UI combobox + option roles).
    const themeSelect = settingsDialog.getByRole("combobox", {
      name: "Theme",
    })
    await expect(themeSelect).toBeVisible()

    // Switch to Dark and verify the preference applies to the document
    await themeSelect.click()
    await page.getByRole("option", { name: "Dark", exact: true }).click()
    await expect(themeSelect).toContainText("Dark")
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.classList.contains("dark"))
      )
      .toBe(true)

    // Switch to Light and verify the preference reverts
    await themeSelect.click()
    await page.getByRole("option", { name: "Light", exact: true }).click()
    await expect(themeSelect).toContainText("Light")
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.classList.contains("dark"))
      )
      .toBe(false)
  })

  // Cleanup mocked routes after each test to prevent interference
  test.afterEach(async ({ page }) => {
    await page.unroute((url) => url.pathname.startsWith("/api/chat"))
  })
})
