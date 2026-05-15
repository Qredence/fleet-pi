import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChatModeSchema, ChatSessionMetadataSchema } from "./chat-protocol.zod"
import type { ChatMode, ChatSessionMetadata } from "./chat-protocol"

const CHAT_SESSION_STORAGE_KEY = "fleet-pi-chat-session"
const CHAT_SESSION_BY_SCOPE_STORAGE_KEY = "fleet-pi-chat-sessions"
const CHAT_MODE_STORAGE_KEY = "fleet-pi-chat-mode"

type ChatSessionScope = "normal" | "harness"
type StoredChatSessions = Record<ChatSessionScope, ChatSessionMetadata>

const EMPTY_STORED_SESSIONS: StoredChatSessions = {
  normal: {},
  harness: {},
}

export function useChatStorage() {
  const [sessionMetadataByScope, setSessionMetadataByScope] =
    useState<StoredChatSessions>(() => readStoredBrowserSessions())
  // Default to "agent" for SSR hydration safety. The stored mode is applied
  // in useEffect after mount to avoid hydration mismatches.
  const [mode, setMode] = useState<ChatMode>("agent")
  const modeRef = useRef(mode)
  const activeSessionScope = getChatSessionScope(mode)
  const sessionMetadata = useMemo(
    () => sessionMetadataByScope[activeSessionScope],
    [activeSessionScope, sessionMetadataByScope]
  )
  const setSessionMetadata = useCallback(
    (metadata: ChatSessionMetadata, modeOverride?: ChatMode) => {
      const scope = getChatSessionScope(modeOverride ?? modeRef.current)
      setSessionMetadataByScope((current) => ({
        ...current,
        [scope]: metadata,
      }))
    },
    []
  )

  useEffect(() => {
    const storedMode = readStoredMode()
    if (storedMode !== mode) {
      setMode(storedMode)
    }
  }, [])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    storeBrowserSessions(sessionMetadataByScope)
  }, [sessionMetadataByScope])

  useEffect(() => {
    storeMode(mode)
  }, [mode])

  return {
    sessionMetadata,
    setSessionMetadata,
    mode,
    setMode,
  }
}

export function getChatSessionScope(mode: ChatMode): ChatSessionScope {
  return mode === "harness" ? "harness" : "normal"
}

function readStoredBrowserSessions(): StoredChatSessions {
  if (typeof window === "undefined") return EMPTY_STORED_SESSIONS

  try {
    const raw = window.localStorage.getItem(CHAT_SESSION_BY_SCOPE_STORAGE_KEY)
    if (!raw) return readLegacyStoredBrowserSessions()
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") {
      return readLegacyStoredBrowserSessions()
    }
    const candidate = parsed as Partial<Record<ChatSessionScope, unknown>>
    return {
      normal: parseSessionMetadata(candidate.normal),
      harness: parseSessionMetadata(candidate.harness),
    }
  } catch {
    return readLegacyStoredBrowserSessions()
  }
}

function readLegacyStoredBrowserSessions(): StoredChatSessions {
  if (typeof window === "undefined") return EMPTY_STORED_SESSIONS
  const raw = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY)
  if (!raw) return EMPTY_STORED_SESSIONS

  try {
    return {
      ...EMPTY_STORED_SESSIONS,
      normal: parseSessionMetadata(JSON.parse(raw) as unknown),
    }
  } catch {
    return EMPTY_STORED_SESSIONS
  }
}

function parseSessionMetadata(value: unknown): ChatSessionMetadata {
  const result = ChatSessionMetadataSchema.safeParse(value)
  return result.success ? result.data : {}
}

function storeBrowserSessions(sessions: StoredChatSessions) {
  if (typeof window === "undefined") return

  const hasSession = Object.values(sessions).some(
    (metadata) => metadata.sessionFile || metadata.sessionId
  )

  if (!hasSession) {
    window.localStorage.removeItem(CHAT_SESSION_BY_SCOPE_STORAGE_KEY)
    window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(
    CHAT_SESSION_BY_SCOPE_STORAGE_KEY,
    JSON.stringify(sessions)
  )
  window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY)
}

function readStoredMode(): ChatMode {
  if (typeof window === "undefined") return "agent"

  const raw = window.localStorage.getItem(CHAT_MODE_STORAGE_KEY)
  if (!raw) return "agent"

  const parsed = ChatModeSchema.safeParse(raw)
  if (parsed.success) return parsed.data

  const jsonParsed = ChatModeSchema.safeParse(parseLegacyModeString(raw))
  return jsonParsed.success ? jsonParsed.data : "agent"
}

function parseLegacyModeString(raw: string) {
  if (raw === '"plan"') return "plan"
  if (raw === '"agent"') return "agent"
  if (raw === '"harness"') return "harness"
  return raw
}

function storeMode(mode: ChatMode) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CHAT_MODE_STORAGE_KEY, mode)
}
