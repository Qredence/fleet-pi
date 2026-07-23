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
        // Required when the app origin differs from the Managed Auth URL
        // (Vercel ↔ neonauth), otherwise token() returns undefined.
        fetchOptions: { credentials: "include" },
      }),
    }) as unknown as BetterAuthReactClient
  }

  return createBetterAuthClient()
}

export const authClient = createFleetAuthClient()

/**
 * Returns a Neon Auth JWT for cross-origin chat APIs (Vercel → Neon cookies
 * are not sent to fleet-pi-web). Never throws — callers must tolerate null.
 */
export async function getChatAuthBearerToken(): Promise<string | null> {
  if (!isNeonManagedAuthClientEnabled()) {
    return null
  }

  try {
    const { data, error } = await (authClient as NeonAuthTokenClient).token()
    if (error) {
      return null
    }

    return typeof data?.token === "string" && data.token.length > 0
      ? data.token
      : null
  } catch {
    return null
  }
}
