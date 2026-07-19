import { tanstackStartCookies } from "better-auth/tanstack-start"
import type { BetterAuthPlugin } from "better-auth"

/**
 * TanStack Start cookie plugin for Better Auth. Kept out of
 * legacy-better-auth-server.ts so Neon Function bundles do not pull
 * @tanstack/start-server-core.
 */
export function getLegacyBetterAuthTanstackPlugins(): Array<BetterAuthPlugin> {
  return [tanstackStartCookies()]
}
