import { describe, expect, it } from "vitest"
import {
  CHAT_POSTGRES_FORCE_RLS_MIGRATION_ID,
  CHAT_POSTGRES_FORCE_RLS_SQL,
} from "../chat-postgres-force-rls"

describe("chat-postgres-force-rls", () => {
  it("forces RLS on owner-bound pi_* tables", () => {
    expect(CHAT_POSTGRES_FORCE_RLS_MIGRATION_ID).toBe(
      "20260723_pi_force_row_level_security"
    )
    expect(CHAT_POSTGRES_FORCE_RLS_SQL).toContain(
      "ALTER TABLE IF EXISTS public.pi_sessions FORCE ROW LEVEL SECURITY"
    )
    expect(CHAT_POSTGRES_FORCE_RLS_SQL).toContain(
      "ALTER TABLE IF EXISTS public.pi_user_providers FORCE ROW LEVEL SECURITY"
    )
    expect(CHAT_POSTGRES_FORCE_RLS_SQL).toContain(
      "ALTER TABLE IF EXISTS public.pi_user_settings FORCE ROW LEVEL SECURITY"
    )
  })
})
