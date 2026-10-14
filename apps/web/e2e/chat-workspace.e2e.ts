import { expect, test } from "@playwright/test"
import {
  MOCK_WORKSPACE_TREE,
  MOCK_WORKSPACE_TREE_WITHOUT_FACTORY,
  expandWorkspacePath,
  mockChatModels,
  mockChatResources,
  mockChatSessions,
  mockChatStream,
  mockWorkspaceFile,
  mockWorkspaceTree,
} from "./chat-flows-support"

test.describe("chat workspace", () => {
  test("shows the agent workspace filesystem tab", async ({ page }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.getByRole("tab", { name: "Pi Resources" }).click()

    const resourcesCanvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(resourcesCanvas).toBeVisible()
    await page.getByRole("tab", { name: "Workspace", exact: true }).click()

    const workspaceCanvas = page.locator('[data-testid="pi-workspace-canvas"]')
    await expect(workspaceCanvas).toBeVisible()
    const workspaceTree = workspaceCanvas.locator(
      '[data-testid="workspace-tree"]'
    )
    await expect(workspaceTree).toBeVisible()
    await expect(workspaceTree.getByText("agent-workspace")).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "memory", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "pi", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "system", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "scratch", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "identity.md", exact: true })
    ).toHaveCount(0)
    await expect(
      workspaceTree.getByRole("button", { name: "factory.md", exact: true })
    ).toHaveCount(0)

    await expandWorkspacePath(workspaceTree, ["memory", "research"])
    await expect(
      workspaceTree.getByRole("button", { name: "factory.md", exact: true })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", { name: "hermes.md", exact: true })
    ).toBeVisible()

    await expandWorkspacePath(workspaceTree, ["system"])
    await expect(
      workspaceTree.getByRole("button", {
        name: "workspace-policy.md",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      workspaceTree.getByRole("button", {
        name: "constraints.md",
        exact: true,
      })
    ).toBeVisible()

    await expandWorkspacePath(workspaceTree, ["scratch", "tmp"])
    await expect(
      workspaceTree.getByRole("button", { name: ".gitkeep", exact: true })
    ).toBeVisible()

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
    await expect(
      workspaceTree.getByText("Diagnostics", { exact: true })
    ).toHaveCount(0)

    await page.getByRole("tab", { name: "Pi Resources" }).click()
    await expect(
      resourcesCanvas.getByText("codebase-research", { exact: true })
    ).toBeVisible()
  })

  test("shows the artifacts tab scoped to agent-workspace/artifacts", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page
      .getByRole("tab", { name: "Workspace artifacts", exact: true })
      .click()

    const artifactsCanvas = page.locator('[data-testid="pi-artifacts-canvas"]')
    await expect(artifactsCanvas).toBeVisible()

    const artifactsTree = artifactsCanvas.locator(
      '[data-testid="artifacts-tree"]'
    )
    await expect(artifactsTree).toBeVisible()
    await expect(artifactsTree.getByText("artifacts")).toBeVisible()
    await expect(
      artifactsTree.getByRole("button", { name: "memory", exact: true })
    ).toHaveCount(0)
    await expect(
      artifactsTree.getByText("Diagnostics", { exact: true })
    ).toHaveCount(0)
    await expect(
      artifactsTree.getByRole("button", { name: "reports", exact: true })
    ).toBeVisible()

    await expandWorkspacePath(artifactsTree, ["reports"])
    await artifactsTree
      .getByRole("button", { name: "summary.md", exact: true })
      .click()

    const preview = artifactsCanvas.locator('[data-testid="workspace-preview"]')
    await expect(preview).toBeVisible()
    await expect(preview.getByText("summary.md", { exact: true })).toBeVisible()
  })

  test("clears workspace preview when switching to the artifacts tab", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.getByRole("tab", { name: "Workspace", exact: true }).click()

    const workspaceCanvas = page.locator('[data-testid="pi-workspace-canvas"]')
    await expect(workspaceCanvas).toBeVisible()

    const workspaceTree = workspaceCanvas.locator(
      '[data-testid="workspace-tree"]'
    )
    await expandWorkspacePath(workspaceTree, ["memory", "project"])
    await workspaceTree
      .getByRole("button", { name: "architecture.md", exact: true })
      .click()

    const workspacePreview = workspaceCanvas.locator(
      '[data-testid="workspace-preview"]'
    )
    await expect(
      workspacePreview.getByText("architecture.md", { exact: true })
    ).toBeVisible()

    await page
      .getByRole("tab", { name: "Workspace artifacts", exact: true })
      .click()

    const artifactsCanvas = page.locator('[data-testid="pi-artifacts-canvas"]')
    await expect(artifactsCanvas).toBeVisible()

    const artifactsPreview = artifactsCanvas.locator(
      '[data-testid="workspace-preview"]'
    )
    await expect(
      artifactsPreview.getByText("Select an artifact", { exact: true })
    ).toBeVisible()
    await expect(
      artifactsPreview.getByText("architecture.md", { exact: true })
    ).toHaveCount(0)
  })

  test("clears artifact preview when switching to the workspace tab", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page
      .getByRole("tab", { name: "Workspace artifacts", exact: true })
      .click()

    const artifactsCanvas = page.locator('[data-testid="pi-artifacts-canvas"]')
    await expect(artifactsCanvas).toBeVisible()

    const artifactsTree = artifactsCanvas.locator(
      '[data-testid="artifacts-tree"]'
    )
    await expandWorkspacePath(artifactsTree, ["reports"])
    await artifactsTree
      .getByRole("button", { name: "summary.md", exact: true })
      .click()

    const artifactsPreview = artifactsCanvas.locator(
      '[data-testid="workspace-preview"]'
    )
    await expect(
      artifactsPreview.getByText("summary.md", { exact: true })
    ).toBeVisible()

    await page.getByRole("tab", { name: "Workspace", exact: true }).click()

    const workspaceCanvas = page.locator('[data-testid="pi-workspace-canvas"]')
    await expect(workspaceCanvas).toBeVisible()

    const workspacePreview = workspaceCanvas.locator(
      '[data-testid="workspace-preview"]'
    )
    await expect(
      workspacePreview.getByText("Select a file", { exact: true })
    ).toBeVisible()
    await expect(
      workspacePreview.getByText("summary.md", { exact: true })
    ).toHaveCount(0)
  })

  test("opens artifacts from a completed Write tool path click", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)
    await mockChatStream(page, {
      assistantText: "Saved the artifact report.",
      toolParts: [
        {
          type: "tool-Write",
          toolCallId: "write-artifact-summary",
          state: "output-available",
          input: {
            file_path: "agent-workspace/artifacts/reports/summary.md",
            content: "# Summary\n\nArtifact report preview.\n",
          },
          output: {
            content: "# Summary\n\nArtifact report preview.\n",
          },
        },
      ],
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await textarea.fill("Write an artifact report")
    await page.keyboard.press("Enter")

    const writePathButton = page.getByRole("button", {
      name: "summary.md",
      exact: true,
    })
    await expect(writePathButton).toBeVisible({ timeout: 10000 })
    await writePathButton.click()

    const artifactsCanvas = page.locator('[data-testid="pi-artifacts-canvas"]')
    await expect(artifactsCanvas).toBeVisible()
    const preview = artifactsCanvas.locator('[data-testid="workspace-preview"]')
    await expect(preview.getByText("summary.md", { exact: true })).toBeVisible()
    await expect(
      preview.getByRole("heading", { name: "Summary" })
    ).toBeVisible()
  })

  test("keeps workspace browsing and chat usable after resource browsing", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page)
    await mockWorkspaceFile(page)
    await mockChatStream(page, {
      assistantText: "Diagnostics do not block chat.",
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await page.getByRole("tab", { name: "Pi Resources" }).click()
    const resourcesCanvas = page.locator('[data-testid="pi-resources-canvas"]')
    await expect(resourcesCanvas).toBeVisible()
    await expect(
      resourcesCanvas.getByTestId("resource-chip-section-diagnostics")
    ).toHaveCount(0)

    await page.getByRole("tab", { name: "Workspace", exact: true }).click()
    const workspaceCanvas = page.locator('[data-testid="pi-workspace-canvas"]')
    await expect(workspaceCanvas).toBeVisible()
    const workspaceTree = workspaceCanvas.locator(
      '[data-testid="workspace-tree"]'
    )
    await expandWorkspacePath(workspaceTree, ["memory", "research"])
    await workspaceTree.getByRole("button", { name: "factory.md" }).click()

    const preview = workspaceCanvas.locator('[data-testid="workspace-preview"]')
    await expect(
      preview.getByRole("heading", { name: "Factory" })
    ).toBeVisible()
    await expect(
      workspaceCanvas.getByText("Diagnostics", { exact: true })
    ).toHaveCount(0)

    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await expect(textarea).toBeVisible()
    await textarea.fill("Can you still help?")
    await page.keyboard.press("Enter")

    await expect(page.locator("text=Can you still help?").first()).toBeVisible()
    await expect(
      page.locator("text=Diagnostics do not block chat.")
    ).toBeVisible({ timeout: 10000 })
  })

  test("clears stale workspace previews for degraded responses and refresh removals", async ({
    page,
  }) => {
    await mockChatModels(page)
    await mockChatSessions(page)
    await mockChatResources(page)
    await mockWorkspaceTree(page, [
      MOCK_WORKSPACE_TREE,
      MOCK_WORKSPACE_TREE_WITHOUT_FACTORY,
    ])
    await mockWorkspaceFile(page)

    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.getByRole("tab", { name: "Workspace", exact: true }).click()

    const workspaceCanvas = page.locator('[data-testid="pi-workspace-canvas"]')
    await expect(workspaceCanvas).toBeVisible()
    const workspaceTree = workspaceCanvas.locator(
      '[data-testid="workspace-tree"]'
    )
    const preview = workspaceCanvas.locator('[data-testid="workspace-preview"]')

    await expandWorkspacePath(workspaceTree, ["memory", "research"])
    await workspaceTree.getByRole("button", { name: "factory.md" }).click()
    await expect(
      preview.getByRole("heading", { name: "Factory" })
    ).toBeVisible()

    await expandWorkspacePath(workspaceTree, ["artifacts", "reports"])
    await workspaceTree.getByRole("button", { name: "large-report.md" }).click()
    await expect(preview.getByText("Preview too large")).toBeVisible()
    await expect(preview.getByRole("heading", { name: "Factory" })).toHaveCount(
      0
    )

    await workspaceTree
      .getByRole("button", { name: "binary-report.bin" })
      .click()
    await expect(preview.getByText("Unsupported preview")).toBeVisible()
    await expect(preview.getByRole("heading", { name: "Factory" })).toHaveCount(
      0
    )

    await workspaceTree.getByRole("button", { name: "broken.md" }).click()
    await expect(preview.getByText("Unable to load preview")).toBeVisible()
    await expect(
      preview.getByText("Workspace preview is temporarily unavailable.")
    ).toBeVisible()
    await expect(preview.getByRole("heading", { name: "Factory" })).toHaveCount(
      0
    )

    await workspaceTree.getByRole("button", { name: "factory.md" }).click()
    await expect(
      preview.getByRole("heading", { name: "Factory" })
    ).toBeVisible()
    await workspaceCanvas
      .getByRole("button", { name: "Refresh Workspace" })
      .click()

    await expect(
      workspaceTree.getByRole("button", { name: "factory.md", exact: true })
    ).toHaveCount(0)
    await expect(preview.getByText("Select a file")).toBeVisible()
    await expect(preview.getByRole("heading", { name: "Factory" })).toHaveCount(
      0
    )
  })
})
