import { afterEach, describe, expect, it } from "vitest"
import { assertDeploymentReadyOnBoot } from "../boot-check"

describe("assertDeploymentReadyOnBoot", () => {
  const originalVercel = process.env.VERCEL
  const originalRegion = process.env.VERCEL_REGION
  const originalSecret = process.env.BETTER_AUTH_SECRET

  afterEach(() => {
    if (originalVercel === undefined) {
      delete process.env.VERCEL
    } else {
      process.env.VERCEL = originalVercel
    }
    if (originalRegion === undefined) {
      delete process.env.VERCEL_REGION
    } else {
      process.env.VERCEL_REGION = originalRegion
    }
    if (originalSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET
    } else {
      process.env.BETTER_AUTH_SECRET = originalSecret
    }
  })

  it("does not throw outside Vercel", () => {
    delete process.env.VERCEL
    delete process.env.VERCEL_REGION

    expect(() => assertDeploymentReadyOnBoot()).not.toThrow()
  })

  it("does not throw during Vercel build when serverless runtime markers are absent", () => {
    process.env.VERCEL = "1"
    delete process.env.VERCEL_REGION
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
    delete process.env.BETTER_AUTH_SECRET

    expect(() => assertDeploymentReadyOnBoot()).not.toThrow()
  })

  it("throws on Vercel serverless runtime when required env vars are missing", () => {
    process.env.VERCEL = "1"
    process.env.VERCEL_REGION = "iad1"
    delete process.env.BETTER_AUTH_SECRET

    expect(() => assertDeploymentReadyOnBoot()).toThrow(
      /Deployment readiness check failed/
    )
  })
})
