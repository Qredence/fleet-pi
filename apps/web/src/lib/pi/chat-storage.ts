import type { ChatMode, ChatSessionMetadata } from "./chat-protocol"

const CHAT_SESSION_STORAGE_KEY = "fleet-pi-chat-session"
const CHAT_MODE_STORAGE_KEY = "fleet-pi-chat-mode"

export function readStoredBrowserSession(): ChatSessionMetadata {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ChatSessionMetadata
    return {
      sessionFile:
        typeof parsed.sessionFile === "string" ? parsed.sessionFile : undefined,
      sessionId:
        typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
    }
  } catch {
    return {}
  }
}

export function storeBrowserSession(metadata: ChatSessionMetadata) {
  if (typeof window === "undefined") return

  if (!metadata.sessionFile && !metadata.sessionId) {
    window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(
    CHAT_SESSION_STORAGE_KEY,
    JSON.stringify(metadata)
  )
}

export function readStoredMode(): ChatMode {
  if (typeof window === "undefined") return "agent"
  return window.localStorage.getItem(CHAT_MODE_STORAGE_KEY) === "plan"
    ? "plan"
    : "agent"
}

export function storeMode(mode: ChatMode) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CHAT_MODE_STORAGE_KEY, mode)
}
