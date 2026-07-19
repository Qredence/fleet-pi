import { assertDeploymentReadyOnBoot } from "@/lib/deployment/boot-check"
import { resolveAuthBackend } from "@/lib/auth/auth-mode"

assertDeploymentReadyOnBoot()

const authBackend = resolveAuthBackend()

type AuthSessionResult = {
  user: {
    id: string
    email?: string | null
    name?: string | null
  }
  session?: {
    id?: string
    userId?: string
    token?: string
  } | null
} | null

async function getSessionFromRequest(
  input: Request | { headers: Headers }
): Promise<AuthSessionResult> {
  const request =
    input instanceof Request
      ? input
      : new Request("http://fleet-pi.local/api/auth/get-session", {
          headers: input.headers,
        })

  if (authBackend === "neon-managed") {
    const { getNeonManagedSessionFromRequest } =
      await import("@/lib/auth/neon-managed-auth")
    const session = await getNeonManagedSessionFromRequest(request)
    if (!session?.user?.id) {
      return null
    }
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      session: session.session,
    }
  }

  const { legacyBetterAuth } =
    await import("@/lib/auth/legacy-better-auth-server")
  return legacyBetterAuth.api
    .getSession({ headers: request.headers })
    .catch(() => null)
}

async function handleAuthRequest(request: Request) {
  if (authBackend === "neon-managed") {
    const { handleNeonManagedAuthRequest } =
      await import("@/lib/auth/neon-managed-auth")
    return handleNeonManagedAuthRequest(request)
  }

  const { legacyBetterAuth } =
    await import("@/lib/auth/legacy-better-auth-server")
  return legacyBetterAuth.handler(request)
}

export const auth = {
  api: {
    getSession: getSessionFromRequest,
  },
  handler: handleAuthRequest,
  backend: authBackend,
}
