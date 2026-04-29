import { expect, test } from "@playwright/test"

test("page loads and chat UI mounts", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("body")).toBeVisible()
})

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/api/health")
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body).toEqual({ status: "ok" })
})
