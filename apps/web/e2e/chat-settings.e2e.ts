import { expect, test } from "@playwright/test"
import {
  expandWorkspacePath,
  mockChatCommands,
  mockChatModels,
  mockChatProviders,
  mockChatResources,
  mockChatSessions,
  mockChatSettings,
  mockWorkspaceFile,
  mockWorkspaceTree,
  scrollPanelToEnd,
} from "./chat-flows-support"

test.describe("chat settings", () => {
  test("opens the Settings dialog and applies theme preference", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockChatSettings(page)
    await mockChatProviders(page)
    await mockChatCommands(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Slash command suggestions still resolve from the mocked workspace skill
    const input = page.getByPlaceholder("Send a message...")
    await input.fill("/")
    const helperSuggestion = page.getByRole("option", {
      name: "/frontend-helper",
      exact: true,
    })
    await expect(helperSuggestion).toBeVisible()
    await helperSuggestion.click()
    await expect(input).toHaveValue("/frontend-helper ")
    await input.clear()

    // Open the Pi Resources panel through the header launcher
    await page.getByRole("tab", { name: "Pi Resources" }).click()

    const resourcesCanvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(resourcesCanvas).toBeVisible()
    const inlineLauncher = page.locator(
      '[data-testid="right-panel-inline-launcher"]'
    )
    await expect(inlineLauncher).toBeVisible()
    await expect(
      inlineLauncher.getByRole("tab", { name: "Pi Resources" })
    ).toContainText(/\d+/)

    // Model/provider/sandbox configuration lives in the Settings dialog now
    await page.locator('[aria-label="Open account menu"]').click()
    const settingsMenuButton = page.getByRole("button", {
      name: "Settings",
      exact: true,
    })
    await expect(settingsMenuButton).toBeVisible()
    await settingsMenuButton.click()

    const settingsDialog = page.getByRole("dialog", { name: "Settings" })
    await expect(settingsDialog).toBeVisible()

    const sections = [
      "Appearance",
      "Sandbox",
      "Providers",
      "LLM Models",
      "Skills",
      "Pi Harness",
    ]
    for (const section of sections) {
      await expect(
        settingsDialog.getByRole("button", { name: section, exact: true })
      ).toBeVisible()
    }

    await settingsDialog
      .getByRole("button", { name: "LLM Models", exact: true })
      .click()
    await expect(
      settingsDialog.getByRole("heading", { name: "LLM Models", exact: true })
    ).toBeVisible()

    // Theme preference applies immediately from the Appearance pane
    await settingsDialog
      .getByRole("button", { name: "Appearance", exact: true })
      .click()
    const themeSelect = settingsDialog.getByRole("combobox", { name: "Theme" })
    await expect(themeSelect).toBeVisible()

    await themeSelect.click()
    await page.getByRole("option", { name: "Dark", exact: true }).click()
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.classList.contains("dark"))
      )
      .toBe(true)

    await themeSelect.click()
    await page.getByRole("option", { name: "Light", exact: true }).click()
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.classList.contains("dark"))
      )
      .toBe(false)

    // Close the dialog and keep using the header launcher behind it
    await settingsDialog.press("Escape")
    await expect(settingsDialog).toBeHidden()

    await inlineLauncher
      .getByRole("tab", { name: "Workspace", exact: true })
      .click()
    await expect(
      page.locator(
        '[data-testid="pi-workspace-canvas"] [data-testid="workspace-tree"]'
      )
    ).toBeVisible()

    await inlineLauncher.getByRole("tab", { name: "Pi Resources" }).click()
    await expect(
      resourcesCanvas.getByText("codebase-research", { exact: true })
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

    await page.getByRole("tab", { name: "Pi Resources" }).click()

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
    expect((await canvas.boundingBox())?.width ?? 0).toBeLessThanOrEqual(601)
  })

  test("opens Pi resources as a mobile overlay", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.getByRole("tab", { name: "Pi Resources" }).click()

    await expect(
      page.locator('[data-testid="pi-resources-canvas"]')
    ).not.toBeVisible()
    const mobilePanel = page.locator(
      '[data-testid="pi-resources-mobile-panel"]'
    )
    await expect(mobilePanel).toBeVisible()
    await expect(
      page.locator('[data-testid="right-panel-inline-launcher"]')
    ).toBeVisible()
    await expect(
      mobilePanel.locator('[data-testid="right-panel-panel-launcher"]')
    ).not.toBeVisible()
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
    await mockChatSettings(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.getByRole("tab", { name: "Pi Resources" }).click()

    const mobilePanel = page.locator(
      '[data-testid="pi-resources-mobile-panel"]'
    )
    await expect(mobilePanel).toBeVisible()
    await scrollPanelToEnd(mobilePanel)
    await expect(
      mobilePanel.getByText("AGENTS.md", { exact: true })
    ).toBeVisible()
  })

  test("navigates Settings dialog sections at mobile width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockChatSettings(page)
    await mockChatProviders(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.locator('[aria-label="Open account menu"]').click()
    const settingsMenuButton = page.getByRole("button", {
      name: "Settings",
      exact: true,
    })
    await expect(settingsMenuButton).toBeVisible()
    await settingsMenuButton.click()

    const settingsDialog = page.getByRole("dialog", { name: "Settings" })
    await expect(settingsDialog).toBeVisible()

    // Mobile renders the compact settings tab row instead of the sidebar
    const sectionsTabs = settingsDialog.getByRole("tablist", {
      name: "Settings sections",
    })
    await expect(sectionsTabs).toBeVisible()

    const sections = [
      { tab: "Sandbox", heading: "Sandbox" },
      { tab: "Providers", heading: "Providers" },
      { tab: "LLM Models", heading: "LLM Models" },
      { tab: "Skills", heading: "Skills" },
      { tab: "Pi Harness", heading: "Pi Harness" },
      { tab: "Appearance", heading: "Appearance" },
    ]
    for (const section of sections) {
      await sectionsTabs
        .getByRole("tab", { name: section.tab, exact: true })
        .click()
      await expect(
        settingsDialog.getByRole("heading", {
          name: section.heading,
          exact: true,
        })
      ).toBeVisible()
    }
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

    const workspaceTab = page.getByRole("tab", {
      name: "Workspace",
      exact: true,
    })
    await expect(workspaceTab).toBeVisible()
    await expect(workspaceTab).toBeEnabled()
    await workspaceTab.click()

    const mobilePanel = page.locator(
      '[data-testid="pi-workspace-mobile-panel"]'
    )
    await expect(mobilePanel).toBeVisible()
    const mobileTree = mobilePanel.locator('[data-testid="workspace-tree"]')
    await expect(
      mobileTree.getByRole("button", { name: "memory", exact: true })
    ).toBeVisible()
    await expandWorkspacePath(mobilePanel, ["memory", "research"])
    await mobilePanel.getByRole("button", { name: "factory.md" }).click()

    const preview = mobilePanel.locator('[data-testid="workspace-preview"]')
    await expect(preview.getByRole("heading", { name: "Factory" })).toBeVisible(
      { timeout: 10000 }
    )
    await expect(
      preview.getByText("Purpose: Research notes for Factory.")
    ).toBeVisible()
  })
})
