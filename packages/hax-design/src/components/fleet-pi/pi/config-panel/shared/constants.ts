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
export const FIELD_CONTROL_CLASS =
  "h-8 rounded-[7px] border-border/50 bg-background/70 px-2 py-1.5 text-[12px] text-foreground/70 placeholder:text-foreground/25 focus-visible:border-foreground/25 focus-visible:ring-2 focus-visible:ring-foreground/10"
