import { expect, test } from "@playwright/test"

test.describe("Settings Dialog E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
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
    const llmTab = settingsDialog.getByRole("button", { name: /LLM Provider/ })
    const piHarnessTab = settingsDialog.getByRole("button", {
      name: /Pi Harness/,
    })

    await expect(appearanceTab).toBeVisible()
    await expect(sandboxTab).toBeVisible()
    await expect(llmTab).toBeVisible()
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

    // Test Tab 2: Sandbox Provider
    await settingsDialog.getByRole("button", { name: /Sandbox/ }).click()
    await expect(
      settingsDialog.getByRole("heading", {
        name: "Sandbox Provider",
        exact: true,
      })
    ).toBeVisible()

    // Test Tab 3: LLM Provider
    await settingsDialog.getByRole("button", { name: /LLM Provider/ }).click()
    await expect(
      settingsDialog.getByRole("heading", { name: "LLM Provider", exact: true })
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

    // Find theme customization buttons using exact match to avoid matching the parent tab labels
    const lightBtn = settingsDialog.getByRole("button", {
      name: "Light",
      exact: true,
    })
    const darkBtn = settingsDialog.getByRole("button", {
      name: "Dark",
      exact: true,
    })
    const systemBtn = settingsDialog.getByRole("button", {
      name: "System",
      exact: true,
    })

    await expect(lightBtn).toBeVisible()
    await expect(darkBtn).toBeVisible()
    await expect(systemBtn).toBeVisible()

    // Click 'Dark' and verify the button aria-pressed state or custom behaviors
    await darkBtn.click()
    await expect(darkBtn).toHaveAttribute("aria-pressed", "true")
    await expect(lightBtn).toHaveAttribute("aria-pressed", "false")

    // Click 'Light' and verify state changes
    await lightBtn.click()
    await expect(lightBtn).toHaveAttribute("aria-pressed", "true")
    await expect(darkBtn).toHaveAttribute("aria-pressed", "false")
  })
})
