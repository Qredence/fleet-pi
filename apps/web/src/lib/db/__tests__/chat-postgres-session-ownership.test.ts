import { describe, expect, it } from "vitest"
import { CHAT_POSTGRES_SESSION_OWNERSHIP_SQL } from "../chat-postgres-session-ownership"

describe("chat-postgres-session-ownership", () => {
  it("defines SECURITY DEFINER ownership probe functions", () => {
    expect(CHAT_POSTGRES_SESSION_OWNERSHIP_SQL).toContain(
      "fleet_pi_check_session_owner"
    )
    expect(CHAT_POSTGRES_SESSION_OWNERSHIP_SQL).toContain("SECURITY DEFINER")
    expect(CHAT_POSTGRES_SESSION_OWNERSHIP_SQL).toContain(
      "fleet_pi_lookup_session_id_by_file"
    )
    expect(CHAT_POSTGRES_SESSION_OWNERSHIP_SQL).toContain(
      "GRANT EXECUTE ON FUNCTION fleet_pi_check_session_owner"
    )
  })
})
