import { expect, test } from "@playwright/test"

const previewBaseUrl = process.env.FLEET_PI_PREVIEW_SMOKE_URL

test.describe("preview auth gate", () => {
  test.skip(
    !previewBaseUrl,
    "Set FLEET_PI_PREVIEW_SMOKE_URL to run preview smoke"
  )

  test("rejects anonymous chat mutations", async ({ request }) => {
    const response = await request.post(`${previewBaseUrl}/api/chat/new`)
    expect(response.status()).toBe(401)
  })

  test("rejects anonymous session listing", async ({ request }) => {
    const response = await request.get(`${previewBaseUrl}/api/chat/sessions`)
    expect(response.status()).toBe(401)
  })
})
