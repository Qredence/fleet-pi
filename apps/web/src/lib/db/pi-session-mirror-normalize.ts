import {
  MIRROR_JSON_SANITIZE_OPTIONS,
  sanitizeJsonForStorage,
} from "./json-storage"
import type { SessionEntry } from "@earendil-works/pi-coding-agent"

type NormalizedSessionEntry = {
  role?: string
  customType?: string
  provider?: string
  modelId?: string
  thinkingLevel?: string
  targetEntryId?: string
  fromEntryId?: string
  contentText?: string
  summary?: string
  isError: boolean
  tokensTotal?: number
  costTotal?: number
}

export function normalizeEntry(entry: SessionEntry): NormalizedSessionEntry {
  switch (entry.type) {
    case "message":
      return normalizeMessageEntry(entry)
    case "model_change":
      return {
        provider: entry.provider,
        modelId: entry.modelId,
        contentText: `${entry.provider}/${entry.modelId}`,
        isError: false,
      }
    case "thinking_level_change":
      return {
        thinkingLevel: entry.thinkingLevel,
        contentText: entry.thinkingLevel,
        isError: false,
      }
    case "compaction":
      return {
        summary: entry.summary,
        contentText: entry.summary,
        tokensTotal: entry.tokensBefore,
        isError: false,
      }
    case "branch_summary":
      return {
        fromEntryId: entry.fromId,
        summary: entry.summary,
        contentText: entry.summary,
        isError: false,
      }
    case "custom":
      return {
        customType: entry.customType,
        contentText: textFromUnknown(entry.data),
        isError: false,
      }
    case "custom_message":
      return {
        customType: entry.customType,
        contentText: textFromUnknown(entry.content),
        isError: false,
      }
    case "context_edit":
      // Pi 1.x append-only model-context edit. `replacement: null` omits the
      // target from future provider context; otherwise it replaces only the
      // target's content. Raw history is unchanged; recovery replays raw_entry.
      return {
        targetEntryId: entry.targetId,
        contentText:
          entry.replacement === null
            ? "[omitted from context]"
            : textFromUnknown(entry.replacement.content),
        isError: false,
      }
    case "label":
      return {
        targetEntryId: entry.targetId,
        contentText: entry.label,
        isError: false,
      }
    case "session_info":
      return {
        contentText: entry.name,
        isError: false,
      }
    default:
      return { isError: false }
  }
}

function normalizeMessageEntry(
  entry: Extract<SessionEntry, { type: "message" }>
): NormalizedSessionEntry {
  const message = entry.message as unknown as Record<string, unknown>
  const usage = asRecord(message.usage)
  const cost = asRecord(usage.cost)
  const role = typeof message.role === "string" ? message.role : undefined
  const stopReason =
    typeof message.stopReason === "string" ? message.stopReason : undefined

  return {
    role,
    provider:
      typeof message.provider === "string" ? message.provider : undefined,
    modelId: typeof message.model === "string" ? message.model : undefined,
    contentText: textFromUnknown(message.content),
    isError:
      message.isError === true ||
      stopReason === "error" ||
      stopReason === "aborted",
    tokensTotal:
      typeof usage.totalTokens === "number" ? usage.totalTokens : undefined,
    costTotal: typeof cost.total === "number" ? cost.total : undefined,
  }
}

export function findFirstMessagePreview(entries: Array<SessionEntry>) {
  const firstUserMessage = entries.find(
    (entry) =>
      entry.type === "message" &&
      (entry.message as unknown as { role?: unknown }).role === "user"
  ) as Extract<SessionEntry, { type: "message" }> | undefined

  if (!firstUserMessage) return undefined
  const message = firstUserMessage.message as unknown as { content?: unknown }
  return textFromUnknown(message.content)?.slice(0, 280)
}

function textFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    const text = value
      .map((item) => {
        if (!item || typeof item !== "object") return ""
        const record = item as Record<string, unknown>
        if (typeof record.text === "string") return record.text
        if (typeof record.thinking === "string") return record.thinking
        if (record.type === "toolCall" && typeof record.name === "string") {
          return `tool:${record.name}`
        }
        return ""
      })
      .filter(Boolean)
      .join("\n")
    return text || undefined
  }
  if (value === undefined || value === null) return undefined
  return JSON.stringify(sanitizeForMirror(value))
}

export function sanitizeForMirror(value: unknown): unknown {
  return sanitizeJsonForStorage(value, MIRROR_JSON_SANITIZE_OPTIONS)
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
