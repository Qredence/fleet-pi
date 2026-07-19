import { getChatAuthSurface } from "../auth/chat-auth-surface"
import { isVercelDeployment } from "./environment"

export type DeploymentTrustZone =
  "local" | "vercel-production" | "vercel-preview"

export function resolveDeploymentTrustZone(): DeploymentTrustZone {
  if (!isVercelDeployment()) {
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
  return env.VERCEL === "1"
}

export function requiresAuthenticatedMirrorOwner(
  env: NodeJS.ProcessEnv = process.env
) {
  return shouldFailClosedOnMirrorError(env)
}
