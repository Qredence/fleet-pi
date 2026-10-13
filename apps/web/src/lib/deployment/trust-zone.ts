import { getChatAuthSurface } from "../auth/chat-auth-surface"
import { isCloudflareDeployment, isVercelDeployment } from "./environment"

export type DeploymentTrustZone =
  | "local"
  | "vercel-production"
  | "vercel-preview"
  | "cloudflare-production"
  | "cloudflare-preview"

export function isHostedPreviewTrustZone(zone: DeploymentTrustZone) {
  return zone === "vercel-preview" || zone === "cloudflare-preview"
}

export function isHostedProductionTrustZone(zone: DeploymentTrustZone) {
  return zone === "vercel-production" || zone === "cloudflare-production"
}

export function resolveDeploymentTrustZone(): DeploymentTrustZone {
  if (isCloudflareDeployment()) {
    return process.env.FLEET_PI_DEPLOYMENT_TRUST_ZONE === "preview"
      ? "cloudflare-preview"
      : "cloudflare-production"
  }

  if (process.env.VERCEL !== "1") {
    return "local"
  }

  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv === "preview") {
    return "vercel-preview"
  }

  return "vercel-production"
}

export function isVercelPreviewDeployment() {
  return resolveDeploymentTrustZone() === "vercel-preview"
}

export function isHostedPreviewDeployment() {
  return isHostedPreviewTrustZone(resolveDeploymentTrustZone())
}

/**
 * Fail closed for mirror ownership / DB errors wherever chat auth is required:
 * Vercel, Neon Managed Auth, Neon Function surface, or explicit runtime flag.
 * Keep this aligned with `isChatAuthRequired` without importing chat-api-auth
 * (avoids cycles with auth/server).
 */
export function shouldFailClosedOnMirrorError(
  env: NodeJS.ProcessEnv = process.env
) {
  if (getChatAuthSurface() === "neon-function") {
    return true
  }
  if (env.FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH === "1") {
    return true
  }
  if (env.NEON_AUTH_BASE_URL?.trim() || env.NEON_AUTH_URL?.trim()) {
    return true
  }
  return env.VERCEL === "1" || env.FLEET_PI_DEPLOYMENT === "cloudflare"
}

/**
 * Neon Function mirror writes fail the turn. JSONL on that surface is
 * ephemeral, so a lost write must not be reported as a saved chat.
 * Vercel, Cloudflare, and local Neon Auth keep streaming: Pi JSONL stays
 * the source of truth and a mirror error is logged.
 */
export function shouldFailClosedOnFunctionMirrorWrite() {
  return getChatAuthSurface() === "neon-function"
}

export function requiresAuthenticatedMirrorOwner(
  env: NodeJS.ProcessEnv = process.env
) {
  return shouldFailClosedOnMirrorError(env)
}
