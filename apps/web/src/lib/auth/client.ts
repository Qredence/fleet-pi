import { createAuthClient as createNeonAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"
import { createAuthClient as createBetterAuthClient } from "better-auth/react"
import {
  isNeonManagedAuthClientEnabled,
  resolveClientNeonAuthUrl,
} from "@/lib/auth/auth-mode"

type BetterAuthReactClient = ReturnType<typeof createBetterAuthClient>

type NeonAuthTokenClient = BetterAuthReactClient & {
  token: () => Promise<{
    data?: { token?: string } | null
    error?: unknown
  }>
}

type CachedBearer = {
  token: string
  expiresAtMs: number
}

/** Refresh a bit before JWT `exp` to avoid edge expiry on slow requests. */
const BEARER_EXPIRY_SKEW_MS = 60_000
/** Fallback TTL when the JWT payload has no usable `exp`. */
const BEARER_DEFAULT_TTL_MS = 4 * 60_000

let cachedBearer: CachedBearer | null = null
let inFlightBearer: Promise<string | null> | null = null

/**
 * Neon Auth's React adapter mirrors Better Auth's client surface
 * (`useSession`, `signIn`, `token`, …). Cast once at this boundary rather
 * than forcing a union through every consumer.
 *
 * Prefer `authClient.token()` (JWT plugin) for bearer minting. Do not call
 * `getJWTToken()` on this client — `createAuthClient()` returns the adapter
 * API only, and Better Auth proxies `getJWTToken` to a 404 path.
 */
function createFleetAuthClient(): BetterAuthReactClient {
  if (isNeonManagedAuthClientEnabled()) {
    return createNeonAuthClient(resolveClientNeonAuthUrl(), {
      adapter: BetterAuthReactAdapter({
        // Required when minting through the same-origin `/api/auth` proxy
        // (and previously for cross-origin neonauth hosts).
        fetchOptions: { credentials: "include" },
      }),
    })
  }

  return createBetterAuthClient()
}

export const authClient = createFleetAuthClient()

function readJwtExpiryMs(token: string): number | null {
  try {
    const payloadPart = token.split(".")[1]
    if (!payloadPart) return null
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    )
    const payload = JSON.parse(atob(padded)) as { exp?: unknown }
    return typeof payload.exp === "number" ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function cacheBearerToken(token: string): string {
  const expMs = readJwtExpiryMs(token)
  const expiresAtMs = expMs
    ? Math.max(Date.now() + 1_000, expMs - BEARER_EXPIRY_SKEW_MS)
    : Date.now() + BEARER_DEFAULT_TTL_MS
  cachedBearer = { token, expiresAtMs }
  return token
}

function getCachedBearerToken(): string | null {
  if (!cachedBearer) return null
  if (Date.now() >= cachedBearer.expiresAtMs) {
    cachedBearer = null
    return null
  }
  return cachedBearer.token
}

/** Clears the in-memory bearer cache (e.g. after a 401 so the next call remints). */
export function clearChatAuthBearerTokenCache() {
  cachedBearer = null
  inFlightBearer = null
}

async function mintChatAuthBearerToken(): Promise<string | null> {
  try {
    const { data, error } = await (authClient as NeonAuthTokenClient).token()
    if (error) {
      return null
    }

    const token =
      typeof data?.token === "string" && data.token.length > 0
        ? data.token
        : null
    return token ? cacheBearerToken(token) : null
  } catch {
    return null
  }
}

/**
 * Returns a Neon Auth JWT for chat/workspace APIs. Cookies may live on the
 * app host via `/api/auth` proxy; bearer is still required for API routes.
 * Never throws — callers must tolerate null.
 *
 * Coalesces concurrent mint calls and caches until near JWT expiry.
 */
export async function getChatAuthBearerToken(): Promise<string | null> {
  if (!isNeonManagedAuthClientEnabled()) {
    return null
  }

  const cached = getCachedBearerToken()
  if (cached) {
    return cached
  }

  if (inFlightBearer) {
    return inFlightBearer
  }

  inFlightBearer = (async () => {
    const first = await mintChatAuthBearerToken()
    if (first) return first
    // One retry covers transient proxy/session races on cold loads.
    return mintChatAuthBearerToken()
  })().finally(() => {
    inFlightBearer = null
  })

  return inFlightBearer
}
