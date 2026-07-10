import { describe, expect, it } from "vitest"
import { assertDeploymentReadyOnBoot } from "../boot-check"

describe("assertDeploymentReadyOnBoot", () => {
  it("does not throw outside Vercel", () => {
    const originalVercel = process.env.VERCEL
    delete process.env.VERCEL

    expect(() => assertDeploymentReadyOnBoot()).not.toThrow()

    if (originalVercel === undefined) {
      delete process.env.VERCEL
    } else {
      process.env.VERCEL = originalVercel
    }
  })

  it("throws on Vercel when required env vars are missing", () => {
    const originalVercel = process.env.VERCEL
    const originalSecret = process.env.BETTER_AUTH_SECRET
    process.env.VERCEL = "1"
    delete process.env.BETTER_AUTH_SECRET

    expect(() => assertDeploymentReadyOnBoot()).toThrow(
      /Deployment readiness check failed/
    )

    if (originalSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET
    } else {
      process.env.BETTER_AUTH_SECRET = originalSecret
    }
    if (originalVercel === undefined) {
      delete process.env.VERCEL
    } else {
      process.env.VERCEL = originalVercel
    }
  })
})
