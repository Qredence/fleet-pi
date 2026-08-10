// Provenance-aware workspace memory records (v3).
//
// A memory bullet is one Markdown list item under a canonical or ad hoc
// memory file. Before v3 a bullet was a bare line of text with no identity,
// source, or time. v3 keeps the same human-readable text and adds a trailing
// HTML-comment marker that carries provenance:
//
//   - User's name is Zachary <!-- pi-memory v=3 id=mem_abc source=user ts=2026-08-10T12:00:00Z -->
//
// The marker is an HTML comment, so it stays invisible in rendered Markdown.
// Parsing is tolerant: a bullet without a marker, or with a marker that does
// not parse, becomes a legacy record tagged source "unknown". Reading never
// rewrites the file, so legacy bullets keep their exact text.

export const MEMORY_RECORD_VERSION = 3

export const MEMORY_SOURCE_VALUES = [
  "user",
  "agent",
  "system",
  "tool",
  "import",
  "unknown",
] as const

export type MemorySource = (typeof MEMORY_SOURCE_VALUES)[number]

export type MemoryProvenance = {
  // 3 for a v3 record; 0 for a legacy bullet with no marker.
  version: number
  id: string | null
  source: MemorySource
  // ISO 8601 string exactly as written in the marker, or null when absent.
  timestamp: string | null
  isLegacy: boolean
}

export type MemoryBullet = {
  // Human-readable bullet text with the provenance marker removed.
  text: string
  provenance: MemoryProvenance
}

const MARKER_PATTERN = /<!--\s*pi-memory\s+([^>]*?)\s*-->/

const LEGACY_PROVENANCE: MemoryProvenance = {
  version: 0,
  id: null,
  source: "unknown",
  timestamp: null,
  isLegacy: true,
}

function isMemorySource(value: string): value is MemorySource {
  return (MEMORY_SOURCE_VALUES as ReadonlyArray<string>).includes(value)
}

// Parse the space-separated `key=value` attributes inside a marker.
function parseMarkerAttributes(raw: string): Map<string, string> {
  const attributes = new Map<string, string>()
  for (const match of raw.matchAll(/(\w+)=(\S+)/g)) {
    attributes.set(match[1], match[2])
  }
  return attributes
}

// Read one bullet's text (the part after the leading `- `) into a structured
// record. Never throws and never drops the text.
export function parseMemoryBullet(bulletText: string): MemoryBullet {
  const match = bulletText.match(MARKER_PATTERN)
  if (!match) {
    return { text: bulletText.trim(), provenance: { ...LEGACY_PROVENANCE } }
  }

  const text = bulletText.replace(MARKER_PATTERN, "").trim()
  const attributes = parseMarkerAttributes(match[1])

  const version = Number.parseInt(attributes.get("v") ?? "", 10)
  const sourceValue = attributes.get("source") ?? ""
  const provenance: MemoryProvenance = {
    version: Number.isFinite(version) ? version : MEMORY_RECORD_VERSION,
    id: attributes.get("id") ?? null,
    source: isMemorySource(sourceValue) ? sourceValue : "unknown",
    timestamp: attributes.get("ts") ?? null,
    isLegacy: false,
  }

  return { text, provenance }
}

// Compact, greppable provenance suffix for recall lines. Legacy records add
// no suffix so existing recall output stays stable.
export function formatProvenanceSuffix(provenance: MemoryProvenance): string {
  if (provenance.isLegacy) {
    return ""
  }
  const parts = [`source: ${provenance.source}`]
  if (provenance.timestamp) {
    parts.push(provenance.timestamp)
  }
  if (provenance.id) {
    parts.push(provenance.id)
  }
  return ` [${parts.join("; ")}]`
}
