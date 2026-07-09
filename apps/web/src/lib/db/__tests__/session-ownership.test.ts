import { describe, expect, it } from "vitest"
import { resolveSessionOwnershipFromRow } from "../session-ownership"

describe("resolveSessionOwnershipFromRow", () => {
  it("allows access when the session is not mirrored yet", () => {
    expect(resolveSessionOwnershipFromRow(undefined, "user-1")).toBe(true)
  })

  it("denies access to orphan mirrored sessions without a user_id", () => {
    expect(resolveSessionOwnershipFromRow({ user_id: null }, "user-1")).toBe(
      false
    )
  })

  it("denies access when the mirrored user_id does not match", () => {
    expect(
      resolveSessionOwnershipFromRow({ user_id: "user-2" }, "user-1")
    ).toBe(false)
  })

  it("allows access when the mirrored user_id matches", () => {
    expect(
      resolveSessionOwnershipFromRow({ user_id: "user-1" }, "user-1")
    ).toBe(true)
  })
})
