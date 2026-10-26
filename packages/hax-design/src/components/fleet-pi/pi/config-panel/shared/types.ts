import type { ChatThinkingLevel } from "@workspace/pi-protocol/chat-protocol"

export type ConfigModelInfo = {
  id: string
  name: string
  provider: string
  modelId: string
  version?: string
  reasoning?: boolean
  available?: boolean
  thinkingLevel?: ChatThinkingLevel
}
