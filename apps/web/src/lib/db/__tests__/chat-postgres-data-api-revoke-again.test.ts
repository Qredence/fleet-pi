import { describe, expect, it } from "vitest"
import {
  CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_MIGRATION_ID,
  CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_SQL,
} from "../chat-postgres-data-api-revoke-again"

describe("chat-postgres-data-api-revoke-again", () => {
  it("re-revokes Data API roles and drops the ledger read policy", () => {
    expect(CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_MIGRATION_ID).toBe(
      "20260723_revoke_data_api_pi_grants_again"
    )
    expect(CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_SQL).toContain(
      "DROP POLICY IF EXISTS fleet_pi_chat_migrations_read_only"
    )
    expect(CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_SQL).toContain(
      "REVOKE ALL ON TABLE public.pi_user_settings FROM authenticated"
    )
    expect(CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_SQL).toContain(
      "REVOKE ALL ON TABLE public.pi_sessions FROM anonymous"
    )
    expect(CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_SQL).toContain(
      "REVOKE ALL ON FUNCTION public.fleet_pi_current_user_id() FROM authenticated"
    )
    expect(CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_SQL).toContain(
      "GRANT EXECUTE ON FUNCTION public.fleet_pi_current_user_id() TO fleet_pi_app"
    )
  })
})
