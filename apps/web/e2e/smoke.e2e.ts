import { expect, test } from "@playwright/test"

test("page loads and chat UI mounts", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("body")).toBeVisible()
})
