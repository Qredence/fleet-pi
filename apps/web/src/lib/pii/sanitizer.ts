const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]*[a-zA-Z][a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}/g

const PHONE_PATTERN =
  /(?:\+?\d{1,3}[-.\s]+)?(?:\(\d{3}\)[-.\s]*|\d{3}[-.\s]+)\d{3}[-.\s]+\d{4}|\+\d{1,3}(?:[-.\s]+\d+){1,6}/g

export function sanitizeEmails(text: string): string {
  return text.replace(
    EMAIL_PATTERN,
    (match, offset: number, source: string) => {
      const prefix = source.slice(Math.max(0, offset - 3), offset)
      const suffix = source.slice(offset + match.length)
      if (prefix.endsWith("://")) return match
      if (/^:[a-zA-Z0-9._/-]/.test(suffix)) return match
      if (match.toLowerCase().startsWith("git@") && /^[:/]/.test(suffix)) {
        return match
      }
      return "[EMAIL_REDACTED]"
    }
  )
}

export function sanitizePhones(text: string): string {
  return text.replace(PHONE_PATTERN, (match) => {
    const digitCount = (match.match(/\d/g) ?? []).length
    return digitCount >= 7 ? "[PHONE_REDACTED]" : match
  })
}

export function sanitizePii(text: string): string {
  return sanitizePhones(sanitizeEmails(text))
}
