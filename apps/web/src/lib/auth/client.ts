import { createAuthClient as createNeonAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"
import { createAuthClient as createBetterAuthClient } from "better-auth/react"
import {
  isNeonManagedAuthClientEnabled,
  resolveClientNeonAuthUrl,
} from "@/lib/auth/auth-mode"

type BetterAuthReactClient = ReturnType<typeof createBetterAuthClient>

/**
 * Neon Auth's React adapter mirrors Better Auth's client surface
 * (`useSession`, `signIn`, …). Cast once at this boundary rather than
 * forcing a union through every consumer.
 *
 * Important: `@neondatabase/auth`'s `createAuthClient()` returns only the
 * Better Auth adapter instance, not the NeonAuth wrapper that owns
 * `getJWTToken`. Calling `authClient.getJWTToken()` is therefore treated as
 * a Better Auth path proxy and hits `/get-j-w-t-token` (404). Fetch `/token`
 * directly instead.
 */
function createFleetAuthClient(): BetterAuthReactClient {
  if (isNeonManagedAuthClientEnabled()) {
    return createNeonAuthClient(resolveClientNeonAuthUrl(), {
      adapter: BetterAuthReactAdapter(),
    }) as unknown as BetterAuthReactClient
  }

  return createBetterAuthClient()
}

export const authClient = createFleetAuthClient()

type NeonTokenResponse = {
  token?: unknown
}

/**
 * Returns a Neon Auth JWT for cross-origin chat APIs (Vercel → Neon cookies
 * are not sent to fleet-pi-web). Never throws — callers must tolerate null.
 */
export async function getChatAuthBearerToken(): Promise<string | null> {
  if (!isNeonManagedAuthClientEnabled()) {
    return null
  }

  const base = resolveClientNeonAuthUrl().replace(/\/+$/, "")
  if (!base) {
    return null
  }

  try {
    const response = await fetch(`${base}/token`, {
      credentials: "include",
      method: "GET",
    })
    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as NeonTokenResponse
    return typeof data.token === "string" && data.token.length > 0
      ? data.token
      : null
  } catch {
    return null
  }
}
