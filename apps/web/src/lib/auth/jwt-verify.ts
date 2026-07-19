import { createRemoteJWKSet, jwtVerify } from "jose"
import {
  isNeonManagedAuthConfigured,
  resolveNeonAuthBaseUrl,
} from "@/lib/auth/auth-mode"

export type VerifiedNeonAuthToken = {
  sub: string
  email?: string
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function resolveJwksUrl(env: NodeJS.ProcessEnv = process.env) {
  const explicit =
    env.NEON_AUTH_JWKS_URL?.trim() || env.NEON_AUTH_JWKS?.trim() || ""
  if (explicit) return explicit

  const base = resolveNeonAuthBaseUrl(env)
  if (!base) return ""

  return `${base.replace(/\/+$/, "")}/.well-known/jwks.json`
}

function resolveNeonAuthIssuer(env: NodeJS.ProcessEnv = process.env) {
  return env.NEON_AUTH_ISSUER?.trim() || ""
}

function getJwks() {
  const jwksUrl = resolveJwksUrl()
  if (!jwksUrl) {
    throw new Error("NEON_AUTH_JWKS_URL is required for JWT verification.")
  }

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUrl))
  }

  return jwks
}

export function parseBearerToken(request: Request) {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) {
    return null
  }
  const token = header.slice("Bearer ".length).trim()
  return token.length > 0 ? token : null
}

export async function verifyNeonAuthAccessToken(
  token: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<VerifiedNeonAuthToken | null> {
  if (!resolveJwksUrl(env)) {
    return null
  }

  const issuer = resolveNeonAuthIssuer(env)
  // Fail closed: Neon Managed Auth (and dual-host) must pin issuer so JWKS-only
  // tokens from unexpected issuers are rejected.
  if (isNeonManagedAuthConfigured(env) && !issuer) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: issuer || undefined,
      audience: env.NEON_AUTH_AUDIENCE?.trim() || undefined,
    })

    const sub = typeof payload.sub === "string" ? payload.sub : null
    if (!sub) {
      return null
    }

    const email =
      typeof payload.email === "string"
        ? payload.email
        : typeof payload.user_email === "string"
          ? payload.user_email
          : undefined

    return { sub, email }
  } catch {
    return null
  }
}
