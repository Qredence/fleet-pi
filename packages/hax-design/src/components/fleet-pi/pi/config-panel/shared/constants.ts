import type {
  ChatDeliveryMode,
  ChatThinkingLevel,
  ChatTransport,
} from "../../../../../lib/pi/chat-protocol"

export const THINKING_LEVELS: Array<ChatThinkingLevel> = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]
export const DELIVERY_MODES: Array<ChatDeliveryMode> = ["one-at-a-time", "all"]
export const TRANSPORTS: Array<ChatTransport> = ["auto", "sse", "websocket"]
export { FIELD_CONTROL_CLASS } from "../../../styles/tokens"
