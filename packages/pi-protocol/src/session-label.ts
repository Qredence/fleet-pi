/**
 * Sanitize a session label by trimming whitespace and removing exact
 * half-string duplication (e.g. "abcabc" → "abc").
 */
export function normalizeSessionLabel(label: string): string {
  const trimmed = label.trim()
  if (trimmed.length === 0) return trimmed
  const half = Math.floor(trimmed.length / 2)
  if (half > 0 && trimmed.slice(0, half) === trimmed.slice(half)) {
    return trimmed.slice(0, half)
  }
  return trimmed
}
