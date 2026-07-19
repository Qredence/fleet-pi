import { createAuthClient as createNeonAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"
import { createAuthClient as createBetterAuthClient } from "better-auth/react"
import {
  isNeonManagedAuthClientEnabled,
  resolveClientNeonAuthUrl,
} from "@/lib/auth/auth-mode"

type BetterAuthReactClient = ReturnType<typeof createBetterAuthClient>

type NeonJwtCapableClient = BetterAuthReactClient & {
  getJWTToken?: () => Promise<string | null>
}

/**
 * Neon Auth's React adapter mirrors Better Auth's client surface
 * (`useSession`, `signIn`, …). Cast once at this boundary rather than
 * forcing a union through every consumer.
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

export async function getChatAuthBearerToken() {
  if (!isNeonManagedAuthClientEnabled()) {
    return null
  }

  const neonClient = authClient as NeonJwtCapableClient
  const token = await neonClient.getJWTToken?.()
  return token ?? null
}
