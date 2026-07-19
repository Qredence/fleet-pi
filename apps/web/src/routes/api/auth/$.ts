import { createFileRoute } from "@tanstack/react-router"
import { resolveAuthBackend } from "@/lib/auth/auth-mode"
import { auth } from "@/lib/auth/server"

/**
 * This route only runs in TanStack Start (never the Neon Function bundle).
 * Always attach tanstackStartCookies for local Better Auth so local/dev and
 * Vercel cookie sessions work; Neon Managed Auth uses the shared auth.handler.
 */
async function handleAuthRoute(request: Request) {
  if (resolveAuthBackend() === "local-better-auth") {
    const { legacyBetterAuthWithTanstack } =
      await import("@/lib/auth/legacy-better-auth-tanstack")
    return legacyBetterAuthWithTanstack.handler(request)
  }
  return auth.handler(request)
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handleAuthRoute(request),
      POST: async ({ request }) => handleAuthRoute(request),
    },
  },
})
