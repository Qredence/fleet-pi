const MAX_INLINE_WIDTH = 80
const DEFAULT_INDENT = "  "

/**
 * Deep equality for settings values: object key order is insignificant,
 * array order is significant (settings lists are ordered).
 */
export function settingsValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    return left.every((item, index) => settingsValuesEqual(item, right[index]))
  }
  if (isPlainRecord(left) && isPlainRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) return false
    return leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        settingsValuesEqual(left[key], right[key])
    )
  }
  return false
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type ProjectSettingsEntry = {
  key: string
  /** Raw `"key"`-to-value separator text, e.g. `": "`. */
  separator: string
  /** Raw value text exactly as it appears in the file. */
  valueText: string
  /** Parsed value. */
  value: unknown
}

type ParsedProjectSettingsFile = {
  /** Text before the opening `{` (usually empty). */
  prefix: string
  /** Indentation of the first top-level entry (default two spaces). */
  indent: string
  /** Line break sequence used by the file. */
  lineBreak: string
  /** Raw text between the closing `}` and end of file (e.g. `\n`). */
  suffix: string
  entries: Array<ProjectSettingsEntry>
}

/**
 * Serialize project settings while preserving the source file's formatting:
 * indent width, trailing newline, array wrapping, and key/column spacing.
 * Unchanged fields keep their exact raw text; only semantically changed,
 * added, or removed fields are re-serialized with the detected style.
 *
 * When the resulting content is semantically identical to the source, the
 * returned text is byte-identical to the source (callers can skip writing).
 */
export function serializeProjectSettingsPreservingFormat(
  source: string | undefined,
  next: Record<string, unknown>
): string {
  const parsed =
    source !== undefined ? parseProjectSettingsFile(source) : undefined
  if (!parsed) {
    return `${JSON.stringify(next, null, 2)}\n`
  }

  const retained: Array<string> = []
  const seen = new Set<string>()
  for (const entry of parsed.entries) {
    seen.add(entry.key)
    if (!Object.prototype.hasOwnProperty.call(next, entry.key)) continue
    const nextValue = next[entry.key]
    if (settingsValuesEqual(entry.value, nextValue)) {
      retained.push(
        `${JSON.stringify(entry.key)}${entry.separator}${entry.valueText}`
      )
      continue
    }
    retained.push(
      `${JSON.stringify(entry.key)}${entry.separator}${serializeValue(entry.key, nextValue, parsed.indent)}`
    )
  }

  for (const key of Object.keys(next)) {
    if (seen.has(key)) continue
    retained.push(
      `${JSON.stringify(key)}: ${serializeValue(key, next[key], parsed.indent)}`
    )
  }

  if (retained.length === 0) {
    return `${parsed.prefix}{}${parsed.suffix}`
  }
  // Entries carry no indent of their own; the separators between them do.
  const entryPrefix = `${parsed.lineBreak}${parsed.indent}`
  return `${parsed.prefix}{${retained
    .map((text) => `${entryPrefix}${text}`)
    .join(",")}${parsed.lineBreak}}${parsed.suffix}`
}

function serializeValue(key: string, value: unknown, indent: string): string {
  // Keep short arrays inline (matches the committed `.pi/settings.json`
  // style); wrap long arrays one element per line.
  if (Array.isArray(value)) {
    const inline = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`
    const inlineLength = indent.length + key.length + 2 + 2 + inline.length
    if (value.length === 0) return "[]"
    if (inlineLength <= MAX_INLINE_WIDTH) return inline
    return rebaseIndent(JSON.stringify(value, null, indent), indent)
  }
  if (isPlainRecord(value) && Object.keys(value).length > 0) {
    return rebaseIndent(JSON.stringify(value, null, indent), indent)
  }
  return JSON.stringify(value)
}

/** Indent continuation lines by one extra level when embedding under a key. */
function rebaseIndent(serialized: string, indent: string): string {
  const lines = serialized.split("\n")
  return lines
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join("\n")
}

/**
 * Parse the top-level entries of a JSON object without discarding their raw
 * text. Returns undefined when the source does not look like a single JSON
 * object (callers fall back to normalized serialization).
 */
function parseProjectSettingsFile(
  source: string
): ParsedProjectSettingsFile | undefined {
  const openIndex = source.indexOf("{")
  if (openIndex === -1) return undefined

  const scanner = new JsonTextScanner(source)
  scanner.index = openIndex + 1

  const entries: Array<ProjectSettingsEntry> = []
  let firstEntryIndent: string | undefined
  const lineBreak = source.includes("\r\n") ? "\r\n" : "\n"

  const buildResult = (suffix: string): ParsedProjectSettingsFile => ({
    prefix: source.slice(0, openIndex),
    indent: firstEntryIndent ?? DEFAULT_INDENT,
    lineBreak,
    suffix,
    entries,
  })

  for (;;) {
    const trivia = scanner.readTrivia()
    if (scanner.peek() === "}") {
      scanner.index++
      return buildResult(source.slice(scanner.index))
    }

    if (entries.length === 0) {
      firstEntryIndent = leadingWhitespaceOf(trivia)
    } else {
      if (scanner.peek() !== ",") return undefined
      scanner.index++
      scanner.readTrivia()
      if (scanner.peek() === "}") {
        scanner.index++
        return buildResult(source.slice(scanner.index))
      }
    }

    if (scanner.peek() !== '"') return undefined
    const keyText = scanner.readStringToken()
    if (keyText === undefined) return undefined
    const key = safeJsonParse(keyText)
    if (key === undefined) return undefined

    const separatorStart = scanner.index
    scanner.skipWhitespace()
    if (scanner.peek() !== ":") return undefined
    scanner.index++
    scanner.skipWhitespace()
    const separator = source.slice(separatorStart, scanner.index)

    const valueText = scanner.readValueText()
    if (valueText === undefined) return undefined
    const value = safeJsonParse(valueText)
    if (value === undefined) return undefined

    entries.push({ key: key as string, separator, valueText, value })
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** Whitespace after the last newline in a trivia chunk (the line indent). */
function leadingWhitespaceOf(trivia: string): string {
  const lastNewline = Math.max(
    trivia.lastIndexOf("\n"),
    trivia.lastIndexOf("\r")
  )
  return trivia.slice(lastNewline + 1)
}

/** Zero-dependency JSON text cursor used to locate top-level object fields. */
class JsonTextScanner {
  index = 0
  constructor(private readonly source: string) {}

  peek(): string | undefined {
    return this.index < this.source.length ? this.source[this.index] : undefined
  }

  skipWhitespace() {
    while (this.index < this.source.length) {
      const char = this.source[this.index]
      if (char !== " " && char !== "\t" && char !== "\n" && char !== "\r") break
      this.index++
    }
  }

  /** Whitespace (or any trivia) up to the next significant character. */
  readTrivia(): string {
    const start = this.index
    this.skipWhitespace()
    return this.source.slice(start, this.index)
  }

  /** Consume a JSON string token; returns its raw text or undefined. */
  readStringToken(): string | undefined {
    if (this.peek() !== '"') return undefined
    const start = this.index
    this.index++
    while (this.index < this.source.length) {
      const char = this.source[this.index]
      if (char === "\\") {
        this.index += 2
        continue
      }
      if (char === '"') {
        this.index++
        return this.source.slice(start, this.index)
      }
      this.index++
    }
    return undefined
  }

  /** Consume the raw text of a JSON value (object, array, string, scalar). */
  readValueText(): string | undefined {
    this.skipWhitespace()
    const start = this.index
    const opener = this.peek()
    if (opener === "{" || opener === "[") {
      let depth = 0
      while (this.index < this.source.length) {
        const char = this.source[this.index]
        if (char === '"') {
          if (this.readStringToken() === undefined) return undefined
          continue
        }
        if (char === "{" || char === "[") depth++
        if (char === "}" || char === "]") {
          depth--
          this.index++
          if (depth === 0) return this.source.slice(start, this.index)
          continue
        }
        this.index++
      }
      return undefined
    }
    if (opener === '"') {
      return this.readStringToken()
    }
    while (this.index < this.source.length) {
      const char = this.source[this.index]
      if (
        char === "," ||
        char === "}" ||
        char === "]" ||
        char === " " ||
        char === "\t" ||
        char === "\n" ||
        char === "\r"
      ) {
        break
      }
      this.index++
    }
    const text = this.source.slice(start, this.index)
    return text.length > 0 ? text : undefined
  }
}
