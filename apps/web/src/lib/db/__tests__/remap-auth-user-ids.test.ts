import { describe, expect, it } from "vitest"
import {
  assertNeonAuthUserIdMatch,
  parseRemapFile,
  resolveOldUserId,
} from "../remap-auth-user-ids"

describe("remap-auth-user-ids", () => {
  it("parses email,newUserId rows", () => {
    expect(parseRemapFile("alice@example.com,user-new\n")).toEqual([
      { email: "alice@example.com", newUserId: "user-new" },
    ])
  })

  it("parses email,oldUserId,newUserId rows", () => {
    expect(
      parseRemapFile("alice@example.com,user-old,user-new\n# comment\n")
    ).toEqual([
      {
        email: "alice@example.com",
        oldUserId: "user-old",
        newUserId: "user-new",
      },
    ])
  })

  it("rejects invalid row shapes", () => {
    expect(() => parseRemapFile("only-one-column\n")).toThrow(
      /Invalid remap row/
    )
  })

  it("resolves old user id from CSV or legacy map", () => {
    const legacy = new Map([["alice@example.com", "legacy-id"]])
    expect(
      resolveOldUserId(
        { email: "alice@example.com", newUserId: "neon-id" },
        legacy
      )
    ).toBe("legacy-id")
    expect(
      resolveOldUserId(
        {
          email: "alice@example.com",
          oldUserId: "csv-old",
          newUserId: "neon-id",
        },
        legacy
      )
    ).toBe("csv-old")
  })

  it("validates neon_auth user id against CSV newUserId", () => {
    const neonAuth = new Map([["alice@example.com", "neon-id"]])
    expect(() =>
      assertNeonAuthUserIdMatch("alice@example.com", "neon-id", neonAuth)
    ).not.toThrow()
    expect(() =>
      assertNeonAuthUserIdMatch("alice@example.com", "wrong-id", neonAuth)
    ).toThrow(/does not match neon_auth/)
  })
})
