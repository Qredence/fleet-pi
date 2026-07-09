import { auth } from "@/lib/auth/server"
import { verifySessionOwnership } from "@/lib/db/pi-session-mirror"

export function isVercelChatDeployment() {
  return process.env.VERCEL === "1"
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

export async function enforceChatSessionOwnership(input: {
  sessionId?: string
  userId?: string
}) {
  if (!input.sessionId || !input.userId) {
    return { ok: true as const }
  }

  const isOwner = await verifySessionOwnership(input.sessionId, input.userId)
  if (!isOwner) {
    return { ok: false as const, response: forbiddenSessionResponse() }
  }

  return { ok: true as const }
}
