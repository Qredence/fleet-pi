import { createHash } from "node:crypto"

/**
 * Options for {@link sanitizeJsonForStorage}. Defaults reproduce the
 * workspace-provenance semantics: depth-4 nesting limit, 8k string slicing,
 * and 50 array/object-entry caps.
 */
export interface SanitizeJsonForStorageOptions {
  /** Max nesting depth; deeper values collapse to "[truncated-depth]". */
  maxDepth?: number
  /** Strings longer than this are sliced to this length and suffixed with "…". */
  maxStringLength?: number
  /** Max array items and object entries kept. */
  maxEntries?: number
  /**
   * How to treat functions and symbols (not JSON-serializable):
   * - "stringify" (default): coerce them via `String()` (provenance semantics).
   * - "preserve": keep leaf values as-is and drop them from object entries
   *   (historical pi-session-mirror semantics).
   */
  functionsAndSymbols?: "stringify" | "preserve"
}

/**
 * Sanitizer options reproducing the historical pi-session-mirror
 * `sanitizeForJson`: no depth/string/entry limits, and function/symbol
 * object entries are dropped instead of stringified.
 */
export const MIRROR_JSON_SANITIZE_OPTIONS: SanitizeJsonForStorageOptions = {
  maxDepth: Number.POSITIVE_INFINITY,
  maxStringLength: Number.POSITIVE_INFINITY,
  maxEntries: Number.POSITIVE_INFINITY,
  functionsAndSymbols: "preserve",
}

interface ResolvedSanitizeOptions {
  maxDepth: number
  maxStringLength: number
  maxEntries: number
  functionsAndSymbols: "stringify" | "preserve"
}

export function sanitizeJsonForStorage(
  value: unknown,
  options?: SanitizeJsonForStorageOptions
): unknown {
  return sanitizeValue(value, 0, {
    maxDepth: options?.maxDepth ?? 4,
    maxStringLength: options?.maxStringLength ?? 8_000,
    maxEntries: options?.maxEntries ?? 50,
    functionsAndSymbols: options?.functionsAndSymbols ?? "stringify",
  })
}

function sanitizeValue(
  value: unknown,
  depth: number,
  options: ResolvedSanitizeOptions
): unknown {
  if (depth > options.maxDepth) {
    return "[truncated-depth]"
  }

  if (typeof value === "string") {
    return value.length > options.maxStringLength
      ? `${value.slice(0, options.maxStringLength)}…`
      : value
  }

  if (typeof value === "bigint") {
    return value.toString()
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, options.maxEntries)
      .map((item) => sanitizeValue(item, depth + 1, options))
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return options.functionsAndSymbols === "preserve" ? value : String(value)
  }

  if (!isRecord(value)) {
    return String(value)
  }

  const result: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value).slice(
    0,
    options.maxEntries
  )) {
    if (
      options.functionsAndSymbols === "preserve" &&
      (typeof nested === "function" || typeof nested === "symbol")
    ) {
      continue
    }
    result[key] = sanitizeValue(nested, depth + 1, options)
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * sha256 digest of `${kind}:${value}`. The full hex (64 chars) is returned by
 * default, matching workspace-provenance persisted IDs; pass
 * `{ hexLength: 32 }` to reproduce the historical pi-session-mirror digest
 * length. Outputs are persisted keys — never change a call site's length.
 */
export function deterministicId(
  kind: string,
  value: string,
  options?: { hexLength?: number }
): string {
  const hex = createHash("sha256").update(`${kind}:${value}`).digest("hex")
  return options?.hexLength === undefined
    ? hex
    : hex.slice(0, options.hexLength)
}
