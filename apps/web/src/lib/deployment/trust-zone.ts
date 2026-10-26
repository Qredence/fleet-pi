import { isCloudflareDeployment } from "./environment"

export type DeploymentTrustZone =
  "local" | "cloudflare-production" | "cloudflare-preview"

export function isHostedPreviewTrustZone(zone: DeploymentTrustZone) {
  return zone === "cloudflare-preview"
}

export function isHostedProductionTrustZone(zone: DeploymentTrustZone) {
  return zone === "cloudflare-production"
}

export function resolveDeploymentTrustZone(): DeploymentTrustZone {
  if (isCloudflareDeployment()) {
    return process.env.FLEET_PI_DEPLOYMENT_TRUST_ZONE === "preview"
      ? "cloudflare-preview"
      : "cloudflare-production"
  }

  return "local"
}

export function isHostedPreviewDeployment() {
  return isHostedPreviewTrustZone(resolveDeploymentTrustZone())
}

/**
 * Fail closed for mirror ownership / DB errors wherever chat auth is required:
 * Cloudflare, Neon Managed Auth, or explicit runtime flag.
 * Keep this aligned with `isChatAuthRequired` without importing chat-api-auth
 * (avoids cycles with auth/server).
 */
export function shouldFailClosedOnMirrorError(
  env: NodeJS.ProcessEnv = process.env
) {
  if (env.FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH === "1") {
    return true
  }
  if (env.NEON_AUTH_BASE_URL?.trim() || env.NEON_AUTH_URL?.trim()) {
    return true
  }
  return env.FLEET_PI_DEPLOYMENT === "cloudflare"
}

/**
 * Mirror writes fail the turn when the transcript has no other durable copy.
 * Cloudflare Workers have no durable JSONL until the Agent cutover. Local Neon
 * Auth keeps streaming: Pi JSONL stays the source of truth and a mirror error
 * is logged.
 */
export function shouldFailClosedOnFunctionMirrorWrite(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.FLEET_PI_DEPLOYMENT === "cloudflare"
}

export function requiresAuthenticatedMirrorOwner(
  env: NodeJS.ProcessEnv = process.env
) {
  return shouldFailClosedOnMirrorError(env)
}
