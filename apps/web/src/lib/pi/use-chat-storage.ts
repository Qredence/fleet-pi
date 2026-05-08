import { useLocalStorage } from "usehooks-ts"
import type { ChatMode, ChatSessionMetadata } from "./chat-protocol"

const CHAT_SESSION_STORAGE_KEY = "fleet-pi-chat-session"
const CHAT_MODE_STORAGE_KEY = "fleet-pi-chat-mode"

export function useChatStorage() {
  const [sessionMetadata, setSessionMetadata] =
    useLocalStorage<ChatSessionMetadata>(CHAT_SESSION_STORAGE_KEY, {})

  const [mode, setMode] = useLocalStorage<ChatMode>(
    CHAT_MODE_STORAGE_KEY,
    "agent"
  )

  return {
    sessionMetadata,
    setSessionMetadata,
    mode,
    setMode,
  }
}
