import { expect, test } from "@playwright/test"
import type { Route } from "@playwright/test"

test.describe("OpenUI State Sync E2E Verification", () => {
  test("should load the DevOps dashboard and toggle the metrics visibility reactively", async ({
    page,
  }, testInfo) => {
    // 1. Mock the models, sessions, and resources list endpoints so the app loads cleanly
    await page.route("**/api/chat/models", async (route) => {
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
    })

    await page.route("**/api/chat/sessions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [] }),
      })
    })

    await page.route("**/api/chat/resources", async (route) => {
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

    // 2. Mock the chat API endpoint to stream our DevOps generative UI dashboard
    await page.route("**/api/chat", async (route: Route) => {
      const runId = "test-run-id"
      const assistantId = "test-assistant-id"
      const openuiCode = `root = Root([kpiSwitch, kpisLayout])
$enableKpis = true
kpiSwitch = Switch("enableKpis", $enableKpis, "Display Deployment Metrics")
kpisLayout = $enableKpis ? kpisGrid : null
kpisGrid = Grid([metric1, metric2], 2)
metric1 = Metric("Active Instances", "32")
metric2 = Metric("Last Success Rate", "99.4%")
`

      const events = [
        JSON.stringify({
          type: "start",
          id: assistantId,
          runId,
          sessionFile: "/tmp/openui-verify-session.json",
          sessionId: "openui-verify-session-id",
        }),
        JSON.stringify({
          type: "delta",
          text:
            "Here is your requested DevOps dashboard:\n\n```openui\n" +
            openuiCode +
            "\n```\n",
        }),
        JSON.stringify({
          type: "done",
          runId,
          message: {
            id: assistantId,
            role: "assistant",
            createdAt: Date.now(),
            parts: [
              {
                type: "text",
                text:
                  "Here is your requested DevOps dashboard:\n\n```openui\n" +
                  openuiCode +
                  "\n```\n",
              },
            ],
          },
          sessionFile: "/tmp/openui-verify-session.json",
          sessionId: "openui-verify-session-id",
        }),
      ]

      const body = events.join("\n") + "\n"
      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson; charset=utf-8",
        body,
      })
    })

    // 3. Navigate to the main chat page
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await expect(page.locator("body")).toBeVisible()

    // 4. Fill in the prompt and send it to trigger our mock stream
    const textarea = page.locator('textarea[placeholder="Send a message..."]')
    await expect(textarea).toBeVisible()
    await textarea.click()
    await textarea.fill("Display the DevOps deployment analytics dashboard")
    await page.keyboard.press("Enter")

    // 5. Wait for the OpenUI generative components to render
    const switchLabel = page.locator("text=Display Deployment Metrics")
    await expect(switchLabel).toBeVisible({ timeout: 15000 })

    // 6. Assert initial state: Switch ON, KPI metric cards are visible
    const metric1 = page.locator("text=Active Instances")
    const metric2 = page.locator("text=Last Success Rate")
    await expect(metric1).toBeVisible()
    await expect(metric2).toBeVisible()

    // 7. Save initial screenshot (Switch ON)
    const onScreenshotPath = testInfo.outputPath("openui_switch_on_initial.png")
    await page.screenshot({ path: onScreenshotPath })
    console.log(`Saved screenshot: ${onScreenshotPath}`)

    // 8. Toggle the switch to OFF
    const switchButton = page.locator('[data-slot="switch"]').first()
    await expect(switchButton).toBeVisible()
    await switchButton.click()

    // 9. Assert updated state: KPI metric cards are instantly hidden
    await expect(metric1).not.toBeVisible()
    await expect(metric2).not.toBeVisible()

    // 10. Save toggled screenshot (Switch OFF)
    const offScreenshotPath = testInfo.outputPath(
      "openui_switch_off_toggled.png"
    )
    await page.screenshot({ path: offScreenshotPath })
    console.log(`Saved screenshot: ${offScreenshotPath}`)
  })
})
