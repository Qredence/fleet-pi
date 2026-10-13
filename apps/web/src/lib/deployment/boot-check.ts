import { logger } from "../logger"
import { isCloudflareDeployment, isVercelDeployment } from "./environment"
import { validateDeploymentReadiness } from "./readiness"
import { resolveDeploymentTrustZone } from "./trust-zone"

function isVercelServerlessRuntime() {
  return Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_REGION
  )
}

function isCloudflareWorkerRuntime() {
  return isCloudflareDeployment() && typeof globalThis.caches !== "undefined"
}

function isHostedServerlessRuntime() {
  return isVercelServerlessRuntime() || isCloudflareWorkerRuntime()
}

export function formatReadinessFailure(
  checks: Array<{ id: string; message: string }>
) {
  return checks.map((check) => `${check.id}: ${check.message}`).join("; ")
}

/**
 * Fail closed during hosted serverless cold starts when required auth/chat env is missing.
 * Migration verification remains an operator/CI concern via
 * `pnpm verify-deployment-readiness` with owner migration URLs.
 */
export function assertDeploymentReadyOnBoot() {
  if (!isVercelDeployment() || !isHostedServerlessRuntime()) {
    return
  }

  const result = validateDeploymentReadiness({
    trustZone: resolveDeploymentTrustZone(),
  })

  if (!result.ok) {
    const failed = result.checks.filter((check) => !check.ok)
    const message = formatReadinessFailure(failed)
    logger.error({ failed }, "[deployment] readiness check failed on boot")
    throw new Error(`Deployment readiness check failed: ${message}`)
  }
}
