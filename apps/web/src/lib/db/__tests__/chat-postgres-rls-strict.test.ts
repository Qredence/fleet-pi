import { describe, expect, it } from "vitest"
import { CHAT_POSTGRES_RLS_STRICT_SQL } from "../chat-postgres-rls-strict"

describe("chat postgres RLS strict migration", () => {
  it("does not allow shared access to orphan sessions", () => {
    expect(CHAT_POSTGRES_RLS_STRICT_SQL).not.toContain("user_id IS NULL")
    expect(CHAT_POSTGRES_RLS_STRICT_SQL).toContain(
      "user_id = (SELECT current_setting('app.current_user_id', true))"
    )
  })
})
