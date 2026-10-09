import { describe, expect, it } from "vitest"
import { CHAT_POSTGRES_JWT_USER_POLICIES_SQL as SQL } from "../chat-postgres-jwt-user-policies"

describe("JWT user policies migration", () => {
  it("prefers the Neon Auth JWT subject and falls back to app.current_user_id", () => {
    expect(SQL).toContain("auth.user_id()")
    expect(SQL.indexOf("auth.user_id()")).toBeLessThan(
      SQL.indexOf("current_setting('app.current_user_id', true)")
    )
  })

  it("scopes every pi_* policy with fleet_pi_current_user_id()", () => {
    const policies = SQL.match(/CREATE POLICY \w+/g) ?? []
    expect(policies.length).toBeGreaterThanOrEqual(9)
    expect(SQL).not.toMatch(/USING \(user_id = \(SELECT current_setting/)
  })

  it("grants no table privileges to Data API roles", () => {
    expect(SQL).not.toMatch(
      /GRANT (SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*TO (authenticated|anonymous)/
    )
  })
})
