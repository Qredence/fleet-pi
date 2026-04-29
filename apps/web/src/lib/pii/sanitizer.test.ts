import { describe, expect, it } from "vitest"
import { sanitizeEmails, sanitizePhones, sanitizePii } from "./sanitizer"

describe("sanitizeEmails", () => {
  it("replaces a simple email address", () => {
    const input = "Contact me at alice@example.com for details"
    expect(sanitizeEmails(input)).toBe(
      "Contact me at [EMAIL_REDACTED] for details"
    )
  })

  it("replaces multiple email addresses", () => {
    const input = "Send to alice@example.com and bob@test.org please"
    expect(sanitizeEmails(input)).toBe(
      "Send to [EMAIL_REDACTED] and [EMAIL_REDACTED] please"
    )
  })

  it("replaces emails with dots and plus signs", () => {
    const input = "Reach john.doe+spam@mail.co.uk"
    expect(sanitizeEmails(input)).toBe("Reach [EMAIL_REDACTED]")
  })

  it("does not alter text without emails", () => {
    const input = "Just a regular message with no emails"
    expect(sanitizeEmails(input)).toBe(input)
  })

  it("does not replace invalid email-like strings", () => {
    const input = "Visit http://example.com or contact @username"
    expect(sanitizeEmails(input)).toBe(input)
  })

  it("preserves surrounding text", () => {
    const input = "Before email: support@company.io. After email."
    expect(sanitizeEmails(input)).toBe(
      "Before email: [EMAIL_REDACTED]. After email."
    )
  })
})

describe("sanitizePhones", () => {
  it("replaces a North American phone number with dashes", () => {
    const input = "Call me at 555-555-5555 tomorrow"
    expect(sanitizePhones(input)).toBe("Call me at [PHONE_REDACTED] tomorrow")
  })

  it("replaces a phone number with parentheses", () => {
    const input = "My number is (555) 555-5555"
    expect(sanitizePhones(input)).toBe("My number is [PHONE_REDACTED]")
  })

  it("replaces a phone number with dots", () => {
    const input = "Dial 555.555.5555 for support"
    expect(sanitizePhones(input)).toBe("Dial [PHONE_REDACTED] for support")
  })

  it("replaces a phone number with country code +1", () => {
    const input = "Call +1 555 555 5555"
    expect(sanitizePhones(input)).toBe("Call [PHONE_REDACTED]")
  })

  it("replaces an international phone number", () => {
    const input = "Reach me at +44 20 7946 0958"
    expect(sanitizePhones(input)).toBe("Reach me at [PHONE_REDACTED]")
  })

  it("replaces an international phone with dashes", () => {
    const input = "Contact +91-98765-43210"
    expect(sanitizePhones(input)).toBe("Contact [PHONE_REDACTED]")
  })

  it("does not replace short digit sequences", () => {
    const input = "My pin is 1234 and code is 567"
    expect(sanitizePhones(input)).toBe(input)
  })

  it("does not replace dates", () => {
    const input = "The meeting is on 2026-04-29"
    expect(sanitizePhones(input)).toBe(input)
  })

  it("preserves surrounding text", () => {
    const input = "Before: 555-555-5555. After."
    expect(sanitizePhones(input)).toBe("Before: [PHONE_REDACTED]. After.")
  })

  it("replaces multiple phone numbers", () => {
    const input = "Office: 555-555-5555, Mobile: (555) 555-1234"
    expect(sanitizePhones(input)).toBe(
      "Office: [PHONE_REDACTED], Mobile: [PHONE_REDACTED]"
    )
  })
})

describe("sanitizePii", () => {
  it("replaces both emails and phones in the same text", () => {
    const input = "Email alice@example.com or call 555-555-5555"
    expect(sanitizePii(input)).toBe(
      "Email [EMAIL_REDACTED] or call [PHONE_REDACTED]"
    )
  })

  it("leaves clean text untouched", () => {
    const input = "Hello world, how are you today?"
    expect(sanitizePii(input)).toBe(input)
  })
})
