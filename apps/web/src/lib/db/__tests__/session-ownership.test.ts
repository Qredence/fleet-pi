import { describe, expect, it } from "vitest"
import {
  isSessionAccessAllowed,
  isSessionOwnershipStatus,
  resolveSessionOwnershipFromRow,
  resolveSessionOwnershipStatusFromRow,
} from "../session-ownership"

describe("resolveSessionOwnershipFromRow", () => {
  it("allows access when the session is not mirrored yet", () => {
    expect(resolveSessionOwnershipFromRow(undefined, "user-1")).toBe(true)
    expect(resolveSessionOwnershipStatusFromRow(undefined, "user-1")).toBe(
      "missing"
    )
  })

  it("denies access to orphan mirrored sessions without a user_id", () => {
    expect(resolveSessionOwnershipFromRow({ user_id: null }, "user-1")).toBe(
      false
    )
    expect(
      resolveSessionOwnershipStatusFromRow({ user_id: null }, "user-1")
    ).toBe("orphan")
  })

  it("denies access when the mirrored user_id does not match", () => {
    expect(
      resolveSessionOwnershipFromRow({ user_id: "user-2" }, "user-1")
    ).toBe(false)
    expect(
      resolveSessionOwnershipStatusFromRow({ user_id: "user-2" }, "user-1")
    ).toBe("foreign")
  })

  it("allows access when the mirrored user_id matches", () => {
    expect(
      resolveSessionOwnershipFromRow({ user_id: "user-1" }, "user-1")
    ).toBe(true)
    expect(
      resolveSessionOwnershipStatusFromRow({ user_id: "user-1" }, "user-1")
    ).toBe("owned")
  })
})

describe("isSessionAccessAllowed", () => {
  it("allows owned and missing sessions by default", () => {
    expect(isSessionAccessAllowed("owned")).toBe(true)
    expect(isSessionAccessAllowed("missing")).toBe(true)
  })

  it("denies missing sessions when denyMissing is set", () => {
    expect(isSessionAccessAllowed("missing", { denyMissing: true })).toBe(false)
    expect(isSessionAccessAllowed("owned", { denyMissing: true })).toBe(true)
  })

  it("denies foreign and orphan sessions", () => {
    expect(isSessionAccessAllowed("foreign")).toBe(false)
    expect(isSessionAccessAllowed("orphan")).toBe(false)
  })
})

describe("isSessionOwnershipStatus", () => {
  it("recognizes probe statuses", () => {
    expect(isSessionOwnershipStatus("owned")).toBe(true)
    expect(isSessionOwnershipStatus("foreign")).toBe(true)
    expect(isSessionOwnershipStatus("missing")).toBe(true)
    expect(isSessionOwnershipStatus("orphan")).toBe(true)
    expect(isSessionOwnershipStatus("unknown")).toBe(false)
  })
})
