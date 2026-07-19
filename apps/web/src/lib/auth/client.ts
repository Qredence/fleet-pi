import { createAuthClient } from "@neondatabase/auth"
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters"
import { createAuthClient as createBetterAuthClient } from "better-auth/react"
import {
  isNeonManagedAuthClientEnabled,
  resolveClientNeonAuthUrl,
} from "@/lib/auth/auth-mode"

type BetterAuthReactClient = ReturnType<typeof createBetterAuthClient>

function createFleetAuthClient(): BetterAuthReactClient {
  if (isNeonManagedAuthClientEnabled()) {
    return createAuthClient(resolveClientNeonAuthUrl(), {
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

  const neonClient = authClient as BetterAuthReactClient & {
    getJWTToken?: () => Promise<string | null>
  }
  const token = await neonClient.getJWTToken?.()
  return token ?? null
}
