import { isVercelDeployment } from "@/lib/deployment/environment"

export type AuthBackend = "local-better-auth" | "neon-managed"

const NEON_PROJECT_ID = "jolly-lab-20094853"

export function resolveNeonProjectId() {
  return process.env.FLEET_PI_NEON_PROJECT_ID?.trim() || NEON_PROJECT_ID
}

/**
 * Neon Auth base URL. Prefer Fleet Pi's `NEON_AUTH_BASE_URL`; fall back to
 * `NEON_AUTH_URL` which the Vercel↔Neon integration injects automatically.
 */
export function resolveNeonAuthBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return env.NEON_AUTH_BASE_URL?.trim() || env.NEON_AUTH_URL?.trim() || ""
}

export function isNeonManagedAuthConfigured(
  env: NodeJS.ProcessEnv = process.env
) {
  return resolveNeonAuthBaseUrl(env).length > 0
}

export function resolveAuthBackend(
  env: NodeJS.ProcessEnv = process.env
): AuthBackend {
  if (isNeonManagedAuthConfigured(env)) {
    return "neon-managed"
  }
  return "local-better-auth"
}

export function resolveNeonAuthCookieSecret(
  env: NodeJS.ProcessEnv = process.env
) {
  return (
    env.NEON_AUTH_COOKIE_SECRET?.trim() ?? env.BETTER_AUTH_SECRET?.trim() ?? ""
  )
}

export function resolveClientNeonAuthUrl() {
  const fromVite = import.meta.env.VITE_NEON_AUTH_URL
  if (typeof fromVite === "string" && fromVite.trim()) {
    return fromVite.trim()
  }
  return ""
}

export function isNeonManagedAuthClientEnabled() {
  return resolveClientNeonAuthUrl().length > 0
}

export function isLocalAnonymousAuthAllowed(
  env: NodeJS.ProcessEnv = process.env
) {
  if (isVercelDeployment()) {
    return false
  }
  return !isNeonManagedAuthConfigured(env)
}

export function isDeployedAuthRequired(env: NodeJS.ProcessEnv = process.env) {
  return isVercelDeployment() && isNeonManagedAuthConfigured(env)
}

export function usesConsolidatedNeonDatabase(
  env: NodeJS.ProcessEnv = process.env
) {
  const chatUrl = env.FLEET_PI_CHAT_DATABASE_URL?.trim()
  const authUrl = env.FLEET_PI_AUTH_DATABASE_URL?.trim()
  return Boolean(chatUrl && authUrl && chatUrl === authUrl)
}
