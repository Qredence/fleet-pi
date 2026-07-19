import { createRemoteJWKSet, jwtVerify } from "jose"
import { resolveNeonAuthBaseUrl } from "@/lib/auth/auth-mode"

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
  token: string
): Promise<VerifiedNeonAuthToken | null> {
  if (!resolveJwksUrl()) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: process.env.NEON_AUTH_ISSUER?.trim() || undefined,
      audience: process.env.NEON_AUTH_AUDIENCE?.trim() || undefined,
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
