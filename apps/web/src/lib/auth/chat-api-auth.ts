import { auth } from "@/lib/auth/server"
import { isVercelDeployment } from "@/lib/deployment"
import {
  lookupSessionIdBySessionFile,
  verifySessionOwnership,
} from "@/lib/db/pi-session-mirror"

export type ChatAuthSession = Awaited<ReturnType<typeof getChatAuthSession>>

export type AuthenticatedChatContext = {
  authSession: ChatAuthSession
  userId: string | undefined
}

export function isVercelChatDeployment() {
  return isVercelDeployment()
}

export async function getChatAuthSession(request: Request) {
  return auth.api.getSession({ headers: request.headers }).catch(() => null)
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
  if (isVercelChatDeployment() && !authSession?.user.id) {
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

  if (isVercelChatDeployment() && !input.userId) {
    return { ok: false as const, response: unauthorizedChatResponse() }
  }

  if (!input.userId) {
    return { ok: true as const }
  }

  let sessionId = input.sessionId

  if (!sessionId && input.sessionFile) {
    if (isVercelChatDeployment()) {
      sessionId = await lookupSessionIdBySessionFile(input.sessionFile)
      if (!sessionId) {
        return { ok: false as const, response: forbiddenSessionResponse() }
      }
    } else {
      return { ok: true as const }
    }
  }

  if (!sessionId) {
    return { ok: true as const }
  }

  const isOwner = await verifySessionOwnership(sessionId, input.userId)
  if (!isOwner) {
    return { ok: false as const, response: forbiddenSessionResponse() }
  }

  return { ok: true as const, sessionId }
}
