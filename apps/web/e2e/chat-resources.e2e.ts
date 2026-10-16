import { expect, test } from "@playwright/test"
import {
  mockChatModels,
  mockChatResources,
  mockChatSessions,
  mockChatSettings,
  mockWorkspaceTree,
} from "./chat-flows-support"

test.describe("chat resources", () => {
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

    const resourcesButton = page.getByRole("tab", { name: "Pi Resources" })
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
      Math.floor((viewport?.width ?? 0) * 0.5) - 1
    )

    await expect(canvas.getByText("Pi Resources")).toBeVisible()
    const inlineLauncher = page.locator(
      '[data-testid="right-panel-inline-launcher"]'
    )
    await expect(inlineLauncher).toBeVisible()
    await expect(
      inlineLauncher.getByRole("tab", { name: "Pi Resources" })
    ).toContainText(/\d+/)
    await expect(
      canvas.locator('[data-testid="right-panel-header-launcher"]')
    ).not.toBeVisible()
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
    ).toHaveCount(0)
    await expect(
      page.locator('[aria-label="Open account menu"]')
    ).toContainText("Qredence Fleet")
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
  })

  test("resizes chat content when a side panel opens near desktop width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1013, height: 938 })
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockChatSettings(page)
    await mockWorkspaceTree(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.getByRole("tab", { name: "Pi Resources" }).click()

    const canvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(canvas).toBeVisible()
    await expect(
      page.locator('[data-testid="pi-resources-mobile-panel"]')
    ).not.toBeVisible()

    const chatColumn = page.locator('[data-testid="chat-column"]')
    const input = page.getByPlaceholder("Send a message...")

    const chatBox = await chatColumn.boundingBox()
    const canvasBox = await canvas.boundingBox()
    const inputBox = await input.boundingBox()

    expect(chatBox).not.toBeNull()
    expect(canvasBox).not.toBeNull()
    expect(inputBox).not.toBeNull()
    const canvasLeft = canvasBox?.x ?? 0
    expect((chatBox?.x ?? 0) + (chatBox?.width ?? 0)).toBeLessThanOrEqual(
      canvasLeft + 1
    )
    expect((inputBox?.x ?? 0) + (inputBox?.width ?? 0)).toBeLessThanOrEqual(
      canvasLeft + 1
    )
  })
})
