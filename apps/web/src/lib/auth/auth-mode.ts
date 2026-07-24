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

/**
 * Client auth base URL for Neon Managed Auth.
 *
 * `VITE_NEON_AUTH_URL` is the enablement signal (and documents the upstream
 * Managed Auth host). Prefer the same-origin `/api/auth` proxy with an
 * **absolute** app origin so Better Auth accepts the base URL and session
 * cookies stay first-party. Relative `/api/auth` is rejected by Better Auth
 * (`Invalid base URL`).
 */
export function resolveClientNeonAuthUrl() {
  const fromVite = import.meta.env.VITE_NEON_AUTH_URL
  if (typeof fromVite !== "string" || !fromVite.trim()) {
    return ""
  }

  const appOrigin = resolveClientAppOrigin()
  if (appOrigin) {
    return `${appOrigin}/api/auth`
  }

  // SSR without a known app origin: keep upstream URL so the client can boot;
  // browser navigations still prefer same-origin once `window` is available.
  return fromVite.trim()
}

function resolveClientAppOrigin() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/+$/, "")
  }

  const fromBetterAuth =
    typeof process !== "undefined"
      ? process.env.BETTER_AUTH_URL?.trim()
      : undefined
  if (fromBetterAuth) {
    try {
      return new URL(fromBetterAuth).origin
    } catch {
      // fall through
    }
  }

  const vercelUrl =
    typeof process !== "undefined" ? process.env.VERCEL_URL?.trim() : undefined
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//, "")
    return `https://${host}`
  }

  const fromViteOrigin = import.meta.env.VITE_APP_ORIGIN
  if (typeof fromViteOrigin === "string" && fromViteOrigin.trim()) {
    try {
      return new URL(fromViteOrigin.trim()).origin
    } catch {
      return ""
    }
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
