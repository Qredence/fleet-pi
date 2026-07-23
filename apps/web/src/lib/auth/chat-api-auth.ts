import { isNeonManagedAuthConfigured } from "@/lib/auth/auth-mode"
import { getChatAuthSurface } from "@/lib/auth/chat-auth-surface"
import { isVercelDeployment } from "@/lib/deployment/environment"
import {
  parseBearerToken,
  verifyNeonAuthAccessToken,
} from "@/lib/auth/jwt-verify"
import {
  isUserScopedEphemeralSessionFile,
  lookupSessionIdBySessionFile,
  verifyRunOwnership,
  verifySessionOwnership,
} from "@/lib/db/pi-session-ownership-db"

export type ChatAuthSession = Awaited<ReturnType<typeof getChatAuthSession>>

export type AuthenticatedChatContext = {
  authSession: ChatAuthSession
  userId: string | undefined
}

/**
 * Single chat-auth policy:
 * - Neon Function surface always requires auth
 * - Vercel deployments require auth
 * - Neon Managed Auth configured (web) requires auth
 * - Optional `FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH=1` for explicit gates
 */
export function isChatAuthRequired(env: NodeJS.ProcessEnv = process.env) {
  if (getChatAuthSurface() === "neon-function") {
    return true
  }
  return (
    isVercelDeployment() ||
    isNeonManagedAuthConfigured(env) ||
    env.FLEET_PI_CHAT_RUNTIME_REQUIRE_AUTH === "1"
  )
}

export async function getChatAuthSession(request: Request) {
  const bearer = parseBearerToken(request)
  if (bearer) {
    const verified = await verifyNeonAuthAccessToken(bearer)
    if (verified) {
      return {
        user: {
          id: verified.sub,
          email: verified.email ?? "",
          name: verified.email?.split("@")[0] ?? "User",
        },
        session: {
          id: verified.sub,
          userId: verified.sub,
          token: bearer,
        },
      }
    }
  }

  if (getChatAuthSurface() === "neon-function") {
    return null
  }

  const { auth } = await import("@/lib/auth/server")
  return Promise.resolve(auth.api.getSession(request)).catch(() => null)
}

export function unauthorizedChatResponse() {
  return Response.json({ message: "Unauthorized" }, { status: 401 })
}

export function forbiddenSessionResponse() {
  return Response.json(
    { message: "Forbidden: Session belongs to another user" },
    { status: 403, headers: { "Content-Type": "application/json" } }
  )
}

export async function requireVercelChatAuth(request: Request) {
  const authSession = await getChatAuthSession(request)
  if (isChatAuthRequired() && !authSession?.user.id) {
    return { ok: false as const, response: unauthorizedChatResponse() }
  }
  return { ok: true as const, authSession }
}

export async function withAuthenticatedChatRequest(
  request: Request,
  handler: (ctx: AuthenticatedChatContext) => Promise<Response>
): Promise<Response> {
  const authGate = await requireVercelChatAuth(request)
  if (!authGate.ok) {
    return authGate.response
  }

  return handler({
    authSession: authGate.authSession,
    userId: authGate.authSession?.user.id,
  })
}

export async function enforceChatSessionOwnership(input: {
  sessionId?: string
  sessionFile?: string
  userId?: string
}) {
  const hasSessionIdentifier = Boolean(input.sessionId || input.sessionFile)
  if (!hasSessionIdentifier) {
    return { ok: true as const }
  }

  if (isChatAuthRequired() && !input.userId) {
    return { ok: false as const, response: unauthorizedChatResponse() }
  }

  if (!input.userId) {
    return { ok: true as const }
  }

  let sessionId = input.sessionId

  if (!sessionId && input.sessionFile) {
    if (isChatAuthRequired()) {
      sessionId = await lookupSessionIdBySessionFile(input.sessionFile)
      if (
        !sessionId &&
        !isUserScopedEphemeralSessionFile(input.sessionFile, input.userId)
      ) {
        return { ok: false as const, response: forbiddenSessionResponse() }
      }
    } else {
      return { ok: true as const }
    }
  }

  if (!sessionId) {
    return { ok: true as const }
  }

  const isOwner = await verifySessionOwnership(sessionId, input.userId, {
    sessionFile: input.sessionFile,
  })
  if (!isOwner) {
    return { ok: false as const, response: forbiddenSessionResponse() }
  }

  return { ok: true as const, sessionId }
}

export async function enforceRunOwnership(input: {
  runId?: string
  userId?: string
}) {
  const normalizedRunId = input.runId?.trim()
  if (!normalizedRunId) {
    return { ok: true as const }
  }

  if (isChatAuthRequired() && !input.userId) {
    return { ok: false as const, response: unauthorizedChatResponse() }
  }

  if (!input.userId) {
    return { ok: true as const }
  }

  const isOwner = await verifyRunOwnership(normalizedRunId, input.userId)
  if (!isOwner) {
    return { ok: false as const, response: forbiddenSessionResponse() }
  }

  return { ok: true as const, runId: normalizedRunId }
}
