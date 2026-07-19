import { ChatQuestionAnswerRequestSchema, ChatSessionMetadataSchema  } from "@workspace/pi-protocol/chat-protocol.zod"
import type { ChatQuestionAnswerResponse, ChatSessionMetadata  } from "@workspace/pi-protocol/chat-protocol"
import { resolveAppRuntimeContext } from "@/lib/app-runtime"
import {
  enforceChatSessionOwnership,
  withAuthenticatedChatRequest,
} from "@/lib/auth/chat-api-auth"
import { deleteOwnedPiSession } from "@/lib/db/pi-session-deletion"
import { wrapApiHandler } from "@/lib/api-utils"
import { createRequestLogger } from "@/lib/logger"
import {
  abortActiveSession,
  answerChatQuestion,
  createNewChatSession,
  hydrateChatSession,
  listChatSessions,
} from "@/lib/pi/server"
import { chatRunsHandler } from "@/routes/api/chat/runs"
import { chatRunHandler } from "@/routes/api/chat/run"
import { postChatHandler } from "@/lib/pi/chat-runtime/handlers/post-chat"

function readAllowedOrigins() {
  return (process.env.FLEET_PI_CHAT_RUNTIME_CORS_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function applyCors(request: Request, response: Response) {
  const origin = request.headers.get("origin")
  const allowedOrigins = readAllowedOrigins()
  const headers = new Headers(response.headers)

  // Require an explicit allowlist. Reflecting arbitrary Origin when the list
  // is empty is unsafe with Access-Control-Allow-Credentials.
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin)
    headers.set("Vary", "Origin")
    headers.set("Access-Control-Allow-Credentials", "true")
    headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, x-daytona-api-key, x-request-id"
    )
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function preflightResponse(request: Request) {
  return applyCors(
    request,
    new Response(null, {
      status: 204,
    })
  )
}

export async function handleChatRuntimeRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return preflightResponse(request)
  }

  const url = new URL(request.url)
  const { pathname } = url
  const method = request.method

  let response: Response

  if (method === "POST" && pathname === "/api/chat") {
    response = await postChatHandler(request)
  } else if (method === "POST" && pathname === "/api/chat/new") {
    response = await withAuthenticatedChatRequest(request, async ({ userId }) =>
      Response.json(
        await createNewChatSession(resolveAppRuntimeContext(), { userId })
      )
    )
  } else if (method === "POST" && pathname === "/api/chat/resume") {
    response = await wrapApiHandler(async () =>
      withAuthenticatedChatRequest(request, async ({ userId }) => {
        const metadata = ChatSessionMetadataSchema.parse(await request.json())
        const ownership = await enforceChatSessionOwnership({
          sessionId: metadata.sessionId,
          sessionFile: metadata.sessionFile,
          userId,
        })
        if (!ownership.ok) {
          return ownership.response
        }

        return Response.json(
          await hydrateChatSession(resolveAppRuntimeContext(), metadata, {
            userId,
          })
        )
      })
    )
  } else if (method === "POST" && pathname === "/api/chat/abort") {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
    const log = createRequestLogger(requestId)
    response = await wrapApiHandler(
      async () =>
        withAuthenticatedChatRequest(request, async ({ userId }) => {
          const metadata = ChatSessionMetadataSchema.parse(await request.json())
          const ownership = await enforceChatSessionOwnership({
            sessionId: metadata.sessionId,
            sessionFile: metadata.sessionFile,
            userId,
          })
          if (!ownership.ok) {
            return ownership.response
          }

          const aborted = await abortActiveSession({ ...metadata, userId })
          return Response.json({ aborted })
        }),
      { log }
    )
  } else if (method === "POST" && pathname === "/api/chat/question") {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
    const log = createRequestLogger(requestId)
    response = await wrapApiHandler(
      async () =>
        withAuthenticatedChatRequest(request, async ({ userId }) => {
          resolveAppRuntimeContext()
          const body = ChatQuestionAnswerRequestSchema.parse(
            await request.json()
          )
          const ownership = await enforceChatSessionOwnership({
            sessionId: body.sessionId,
            sessionFile: body.sessionFile,
            userId,
          })
          if (!ownership.ok) {
            return ownership.response
          }

          const result: ChatQuestionAnswerResponse = answerChatQuestion(body)
          return Response.json(result, { status: result.ok ? 200 : 404 })
        }),
      { log }
    )
  } else if (method === "GET" && pathname === "/api/chat/sessions") {
    response = await withAuthenticatedChatRequest(request, async ({ userId }) =>
      Response.json({
        sessions: await listChatSessions(resolveAppRuntimeContext(), {
          userId,
        }),
      })
    )
  } else if (method === "GET" && pathname === "/api/chat/session") {
    response = await wrapApiHandler(async () =>
      withAuthenticatedChatRequest(request, async ({ userId }) => {
        const params = new URL(request.url).searchParams
        const metadata: ChatSessionMetadata = {
          sessionFile: params.get("sessionFile") ?? undefined,
          sessionId: params.get("sessionId") ?? undefined,
        }
        const ownership = await enforceChatSessionOwnership({
          sessionId: metadata.sessionId,
          sessionFile: metadata.sessionFile,
          userId,
        })
        if (!ownership.ok) {
          return ownership.response
        }

        return Response.json(
          await hydrateChatSession(resolveAppRuntimeContext(), metadata, {
            userId,
          })
        )
      })
    )
  } else if (method === "DELETE" && pathname === "/api/chat/session") {
    response = await wrapApiHandler(async () =>
      withAuthenticatedChatRequest(request, async ({ userId }) => {
        if (!userId) {
          return Response.json({ message: "Unauthorized" }, { status: 401 })
        }

        const params = new URL(request.url).searchParams
        const sessionId = params.get("sessionId") ?? undefined
        const sessionFile = params.get("sessionFile") ?? undefined
        const ownership = await enforceChatSessionOwnership({
          sessionId,
          sessionFile,
          userId,
        })
        if (!ownership.ok) {
          return ownership.response
        }

        const result = await deleteOwnedPiSession({
          sessionId,
          sessionFile,
          userId,
        })

        if (!result.deleted) {
          const status =
            result.reason === "mirror-disabled"
              ? 501
              : result.reason === "session-not-owned-or-missing"
                ? 404
                : result.reason === "mirror-unavailable"
                  ? 503
                  : 500

          return Response.json(
            {
              ok: false,
              reason: result.reason ?? "delete-failed",
            },
            { status }
          )
        }

        return Response.json({
          ok: true,
          sessionId: result.sessionId,
          sessionFile: result.sessionFile,
        })
      })
    )
  } else if (method === "GET" && pathname === "/api/chat/runs") {
    response = await withAuthenticatedChatRequest(request, ({ userId }) =>
      chatRunsHandler(request, userId)
    )
  } else if (method === "GET" && pathname === "/api/chat/run") {
    response = await withAuthenticatedChatRequest(request, ({ userId }) =>
      chatRunHandler(request, userId)
    )
  } else if (method === "GET" && pathname === "/health") {
    response = Response.json({ ok: true, service: "fleet-pi-chat-runtime" })
  } else {
    response = Response.json({ message: "Not Found" }, { status: 404 })
  }

  return applyCors(request, response)
}
