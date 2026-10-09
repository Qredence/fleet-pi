import { describe, expect, it } from "vitest"
import { isDaytonaNotConnectedError } from "./chat-helpers"

class ChatRequestError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ChatRequestError"
    this.status = status
  }
}

describe("isDaytonaNotConnectedError", () => {
  it("matches a 403 ChatRequestError", () => {
    expect(
      isDaytonaNotConnectedError(
        new ChatRequestError(403, "daytona_credential_required")
      )
    ).toBe(true)
  })

  it("does not match a non-403 ChatRequestError", () => {
    expect(isDaytonaNotConnectedError(new ChatRequestError(500, "boom"))).toBe(
      false
    )
    expect(
      isDaytonaNotConnectedError(new ChatRequestError(404, "missing"))
    ).toBe(false)
  })

  it("does not match a plain Error or non-error values", () => {
    expect(
      isDaytonaNotConnectedError(new Error("daytona_credential_required"))
    ).toBe(false)
    expect(isDaytonaNotConnectedError("daytona_credential_required")).toBe(
      false
    )
    expect(isDaytonaNotConnectedError(null)).toBe(false)
    expect(isDaytonaNotConnectedError(undefined)).toBe(false)
  })
})
