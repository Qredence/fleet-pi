import { describe, expect, it } from "vitest"
import {
  CHAT_POSTGRES_DATA_API_REVOKE_MIGRATION_ID,
  CHAT_POSTGRES_DATA_API_REVOKE_SQL,
} from "../chat-postgres-data-api-revoke"

describe("chat-postgres-data-api-revoke", () => {
  it("revokes Data API roles from Pi mirror and settings tables", () => {
    expect(CHAT_POSTGRES_DATA_API_REVOKE_MIGRATION_ID).toBe(
      "20260719_revoke_data_api_pi_grants"
    )
    expect(CHAT_POSTGRES_DATA_API_REVOKE_SQL).toContain(
      "REVOKE ALL ON TABLE public.pi_user_providers FROM authenticated"
    )
    expect(CHAT_POSTGRES_DATA_API_REVOKE_SQL).toContain(
      "REVOKE ALL ON TABLE public.pi_user_settings FROM authenticated"
    )
    expect(CHAT_POSTGRES_DATA_API_REVOKE_SQL).toContain(
      "REVOKE ALL ON TABLE public.pi_sessions FROM anonymous"
    )
  })
})
