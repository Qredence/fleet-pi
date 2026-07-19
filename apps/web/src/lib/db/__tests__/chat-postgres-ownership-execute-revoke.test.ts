import { describe, expect, it } from "vitest"
import {
  CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_MIGRATION_ID,
  CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_SQL,
} from "../chat-postgres-ownership-execute-revoke"

describe("chat-postgres-ownership-execute-revoke", () => {
  it("revokes Data API and PUBLIC execute on ownership probes", () => {
    expect(CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_MIGRATION_ID).toBe(
      "20260719_revoke_ownership_probe_execute"
    )
    expect(CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_SQL).toContain(
      "REVOKE ALL ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) FROM PUBLIC"
    )
    expect(CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_SQL).toContain(
      "REVOKE ALL ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) FROM authenticated"
    )
    expect(CHAT_POSTGRES_OWNERSHIP_EXECUTE_REVOKE_SQL).toContain(
      "GRANT EXECUTE ON FUNCTION fleet_pi_check_session_owner(TEXT, TEXT) TO fleet_pi_app"
    )
  })
})
