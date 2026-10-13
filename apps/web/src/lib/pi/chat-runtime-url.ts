import {
  isDurableSessionId,
  isLegacyChatSession,
} from "./durable/durable-session"
import type { ChatSessionMetadata } from "@workspace/pi-protocol/chat-protocol"

const RUNTIME_API_PREFIXES = [
  "/api/chat",
  "/api/chat/abort",
  "/api/chat/question",
  "/api/chat/resume",
  "/api/chat/new",
  "/api/chat/sessions",
  "/api/chat/session",
  "/api/chat/runs",
  "/api/chat/run",
] as const

export function resolveChatRuntimeBaseUrl() {
  const fromVite = import.meta.env.VITE_FLEET_PI_CHAT_RUNTIME_URL
  if (typeof fromVite === "string" && fromVite.trim()) {
    return fromVite.trim().replace(/\/$/, "")
  }
  return ""
}

export function isChatRuntimePath(path: string) {
  return RUNTIME_API_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}?`)
  )
}

export function resolveChatApiUrl(path: string, scope?: ChatSessionMetadata) {
  return resolveChatApiUrlFromBase(resolveChatRuntimeBaseUrl(), path, scope)
}

export function resolveChatApiUrlFromBase(
  base: string,
  path: string,
  scope?: ChatSessionMetadata
) {
  if (!base) {
    return path
  }

  const [pathname, query = ""] = path.split("?")
  if (!pathname || !isChatRuntimePath(pathname)) {
    return path
  }
  if (staysOnWorker(pathname, query, scope)) {
    return path
  }

  return `${base}${path}`
}

function staysOnWorker(
  pathname: string,
  query: string,
  scope: ChatSessionMetadata | undefined
) {
  if (pathname === "/api/chat/sessions" || pathname === "/api/chat/new") {
    return true
  }
  const params = new URLSearchParams(query)
  const sessionId = scope?.sessionId ?? params.get("sessionId") ?? undefined
  const sessionFile =
    scope?.sessionFile ?? params.get("sessionFile") ?? undefined
  if (pathname === "/api/chat") {
    return !isLegacyChatSession({ sessionFile, sessionId })
  }
  if (
    pathname === "/api/chat/session" ||
    pathname === "/api/chat/resume" ||
    pathname === "/api/chat/abort"
  ) {
    if (pathname === "/api/chat/abort") {
      return !isLegacyChatSession({ sessionFile, sessionId })
    }
    return isDurableSessionId(sessionId) && !sessionFile
  }
  return false
}
