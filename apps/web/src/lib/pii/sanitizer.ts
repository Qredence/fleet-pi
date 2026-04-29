const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

const PHONE_PATTERN =
  /(?:\+?\d{1,3}[-.\s()]*)?\(?\d{3}\)?[-.\s]*\d{3}[-.\s]*\d{4}|\+\d{1,3}(?:[-.\s]?\d+){2,6}/g

export function sanitizeEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, "[EMAIL_REDACTED]")
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
