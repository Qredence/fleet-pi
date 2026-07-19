import { createFileRoute } from "@tanstack/react-router"
import {
  isChatAuthRequired,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { issueCsrfToken, validateCsrfRequest } from "@/lib/auth/csrf"
import {
  createUnexpectedWorkspaceQueryErrorResponse,
  createWorkspaceReindexResponse,
} from "@/lib/workspace/workspace-query"
import { resolveWorkspaceContext } from "@/lib/workspace/workspace-context"

const REINDEX_WINDOW_MS = 60_000
const REINDEX_MAX_REQUESTS = 5
const reindexAttempts = new Map<string, Array<number>>()
const reindexCleanup = setInterval(() => {
  const cutoff = Date.now() - REINDEX_WINDOW_MS
  for (const [key, attempts] of reindexAttempts) {
    const recent = attempts.filter((timestamp) => timestamp > cutoff)
    if (recent.length === 0) reindexAttempts.delete(key)
    else reindexAttempts.set(key, recent)
  }
}, REINDEX_WINDOW_MS)
reindexCleanup.unref()

function takeReindexPermit(key: string, now = Date.now()) {
  const cutoff = now - REINDEX_WINDOW_MS
  const recent = (reindexAttempts.get(key) ?? []).filter(
    (timestamp) => timestamp > cutoff
  )
  if (recent.length >= REINDEX_MAX_REQUESTS) {
    reindexAttempts.set(key, recent)
    return false
  }
  recent.push(now)
  reindexAttempts.set(key, recent)
  return true
}

export function resetWorkspaceReindexRateLimitForTests() {
  reindexAttempts.clear()
}

export async function workspaceReindexCsrfHandler(request: Request) {
  return withAuthenticatedChatRequest(request, () => {
    const csrf = issueCsrfToken(request)
    return Promise.resolve(
      Response.json(
        { csrfToken: csrf.token },
        { headers: { "Set-Cookie": csrf.cookie } }
      )
    )
  })
}

export async function workspaceReindexHandler(
  request = new Request("http://localhost/api/workspace/reindex", {
    method: "POST",
  })
) {
  return withAuthenticatedChatRequest(
    request,
    async ({ authSession, userId }) => {
      const bearerAuthenticated = request.headers.has("authorization")
      const protectedDeployment = isChatAuthRequired()
      if (
        protectedDeployment &&
        !bearerAuthenticated &&
        !validateCsrfRequest(request).ok
      ) {
        return Response.json(
          { message: "Invalid CSRF protection" },
          { status: 403 }
        )
      }

      const rateLimitKey = userId ?? `anonymous:${new URL(request.url).origin}`
      if (protectedDeployment && !takeReindexPermit(rateLimitKey)) {
        return Response.json(
          { message: "Workspace reindex rate limit exceeded" },
          { status: 429, headers: { "Retry-After": "60" } }
        )
      }

      const context = await resolveWorkspaceContext(request, authSession?.user)

      try {
        const response = await createWorkspaceReindexResponse(context)
        return Response.json(response.body, { status: response.status })
      } catch (error) {
        return Response.json(
          createUnexpectedWorkspaceQueryErrorResponse(context, error),
          { status: 500 }
        )
      }
    }
  )
}

export const Route = createFileRoute("/api/workspace/reindex")({
  server: {
    handlers: {
      GET: ({ request }) => workspaceReindexCsrfHandler(request),
      POST: ({ request }) => workspaceReindexHandler(request),
    },
  },
})
