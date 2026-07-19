import { isVercelDeployment } from "@/lib/deployment/environment"

export type AuthBackend = "local-better-auth" | "neon-managed"

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
