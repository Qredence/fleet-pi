import { createLegacyBetterAuth } from "@/lib/auth/legacy-better-auth-server"
import { getLegacyBetterAuthTanstackPlugins } from "@/lib/auth/legacy-better-auth-tanstack-plugins"

/** Better Auth with TanStack Start cookies — Vercel/TanStack routes only. */
export const legacyBetterAuthWithTanstack = createLegacyBetterAuth(
  getLegacyBetterAuthTanstackPlugins()
)
