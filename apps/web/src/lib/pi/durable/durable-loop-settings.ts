import type { HarnessSettings } from "@earendil-works/pi-durable"
import type { ChatThinkingLevel } from "@workspace/pi-protocol/chat-protocol"

const THINKING_LEVELS = new Set<ChatThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
])

const QUEUE_MODES = new Set(["all", "one-at-a-time"])

export type DurableLoopSettings = {
  compaction?: {
    enabled?: boolean
    reserveTokens?: number
    keepRecentTokens?: number
    backgroundTokens?: number
  }
  retry?: {
    enabled?: boolean
    maxRetries?: number
    baseDelayMs?: number
    maxAgentDelayMs?: number
  }
  steeringMode?: "all" | "one-at-a-time"
  followUpMode?: "all" | "one-at-a-time"
  thinkingLevel?: ChatThinkingLevel
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function booleanField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === "boolean" ? value : undefined
}

function queueMode(value: unknown): "all" | "one-at-a-time" | undefined {
  return typeof value === "string" && QUEUE_MODES.has(value)
    ? (value as "all" | "one-at-a-time")
    : undefined
}

function thinkingLevel(value: unknown): ChatThinkingLevel | undefined {
  return typeof value === "string" &&
    THINKING_LEVELS.has(value as ChatThinkingLevel)
    ? (value as ChatThinkingLevel)
    : undefined
}

export function durableLoopSettingsFromProject(
  stored: unknown
): DurableLoopSettings {
  if (!isRecord(stored)) return {}
  const compaction = isRecord(stored.compaction)
    ? {
        enabled: booleanField(stored.compaction, "enabled"),
        reserveTokens: numberField(stored.compaction, "reserveTokens"),
        keepRecentTokens: numberField(stored.compaction, "keepRecentTokens"),
        backgroundTokens: numberField(stored.compaction, "backgroundTokens"),
      }
    : undefined
  const retry = isRecord(stored.retry)
    ? {
        enabled: booleanField(stored.retry, "enabled"),
        maxRetries: numberField(stored.retry, "maxRetries"),
        baseDelayMs: numberField(stored.retry, "baseDelayMs"),
        maxAgentDelayMs: numberField(stored.retry, "maxAgentDelayMs"),
      }
    : undefined
  return {
    ...(compaction &&
    Object.values(compaction).some((value) => value !== undefined)
      ? { compaction: dropUndefined(compaction) }
      : {}),
    ...(retry && Object.values(retry).some((value) => value !== undefined)
      ? { retry: dropUndefined(retry) }
      : {}),
    ...(queueMode(stored.steeringMode)
      ? { steeringMode: queueMode(stored.steeringMode) }
      : {}),
    ...(queueMode(stored.followUpMode)
      ? { followUpMode: queueMode(stored.followUpMode) }
      : {}),
    ...(thinkingLevel(stored.defaultThinkingLevel)
      ? { thinkingLevel: thinkingLevel(stored.defaultThinkingLevel) }
      : {}),
  }
}

export function harnessSettingsFromLoop(
  loop: DurableLoopSettings | undefined
): HarnessSettings | undefined {
  if (!loop) return undefined
  const settings: HarnessSettings = {
    ...(loop.compaction ? { compaction: loop.compaction } : {}),
    ...(loop.retry ? { retry: loop.retry } : {}),
    ...(loop.steeringMode ? { steeringMode: loop.steeringMode } : {}),
    ...(loop.followUpMode ? { followUpMode: loop.followUpMode } : {}),
  }
  return Object.keys(settings).length > 0 ? settings : undefined
}

export function durableLoopSettingsKey(loop: DurableLoopSettings | undefined) {
  return JSON.stringify(loop ?? {})
}

function dropUndefined<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).filter((entry) => entry[1] !== undefined)
  ) as T
}
