import { runWithChatAuthSurface } from "@/lib/auth/chat-auth-surface"
import { abortChatHandler } from "@/lib/pi/chat-runtime/handlers/abort"
import { newChatHandler } from "@/lib/pi/chat-runtime/handlers/new"
import { postChatHandler } from "@/lib/pi/chat-runtime/handlers/post-chat"
import { questionChatHandler } from "@/lib/pi/chat-runtime/handlers/question"
import { resumeChatHandler } from "@/lib/pi/chat-runtime/handlers/resume"
import { getChatRunHandler } from "@/lib/pi/chat-runtime/handlers/run"
import { listChatRunsHandler } from "@/lib/pi/chat-runtime/handlers/runs"
import {
  deleteChatSessionHandler,
  getChatSessionHandler,
} from "@/lib/pi/chat-runtime/handlers/session"
import { listChatSessionsHandler } from "@/lib/pi/chat-runtime/handlers/sessions"

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

async function dispatchChatRuntimeRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return preflightResponse(request)
  }

  const { pathname } = new URL(request.url)
  const method = request.method

  if (method === "POST" && pathname === "/api/chat") {
    return postChatHandler(request)
  }
  if (method === "POST" && pathname === "/api/chat/new") {
    return newChatHandler(request)
  }
  if (method === "POST" && pathname === "/api/chat/resume") {
    return resumeChatHandler(request)
  }
  if (method === "POST" && pathname === "/api/chat/abort") {
    return abortChatHandler(request)
  }
  if (method === "POST" && pathname === "/api/chat/question") {
    return questionChatHandler(request)
  }
  if (method === "GET" && pathname === "/api/chat/sessions") {
    return listChatSessionsHandler(request)
  }
  if (method === "GET" && pathname === "/api/chat/session") {
    return getChatSessionHandler(request)
  }
  if (method === "DELETE" && pathname === "/api/chat/session") {
    return deleteChatSessionHandler(request)
  }
  if (method === "GET" && pathname === "/api/chat/runs") {
    return listChatRunsHandler(request)
  }
  if (method === "GET" && pathname === "/api/chat/run") {
    return getChatRunHandler(request)
  }
  if (method === "GET" && pathname === "/health") {
    return Response.json({ ok: true, service: "fleet-pi-chat-runtime" })
  }

  return Response.json({ message: "Not Found" }, { status: 404 })
}

export async function handleChatRuntimeRequest(request: Request) {
  // Neon Functions are not Vercel (`VERCEL=1`); force auth for this surface.
  const response = await runWithChatAuthSurface("neon-function", () =>
    dispatchChatRuntimeRequest(request)
  )
  return applyCors(request, response)
}
