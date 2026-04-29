import { describe, expect, it } from "vitest"
import { healthHandler } from "../../routes/api/health"

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const response = await healthHandler()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ status: "ok" })
  })

  it("responds with application/json content type", async () => {
    const response = await healthHandler()

    expect(response.headers.get("content-type")).toBe("application/json")
  })
})
