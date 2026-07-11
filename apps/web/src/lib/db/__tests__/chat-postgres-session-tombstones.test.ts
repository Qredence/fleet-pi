import { describe, expect, it } from "vitest"
import { CHAT_POSTGRES_SESSION_TOMBSTONES_SQL } from "../chat-postgres-session-tombstones"

describe("chat-postgres-session-tombstones", () => {
  it("creates tombstones table and returns deleted status from ownership probe", () => {
    expect(CHAT_POSTGRES_SESSION_TOMBSTONES_SQL).toContain(
      "CREATE TABLE IF NOT EXISTS pi_session_tombstones"
    )
    expect(CHAT_POSTGRES_SESSION_TOMBSTONES_SQL).toContain("'deleted'")
    expect(CHAT_POSTGRES_SESSION_TOMBSTONES_SQL).toContain(
      "pi_session_tombstones_user_isolation"
    )
  })
})
