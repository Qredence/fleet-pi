import { describe, expect, it } from "vitest"
import {
  CHAT_POSTGRES_DATA_API_AUTH_DEFINER_MIGRATION_ID,
  CHAT_POSTGRES_DATA_API_AUTH_DEFINER_SQL,
  CHAT_POSTGRES_DATA_API_AUTH_MIGRATION_ID,
  CHAT_POSTGRES_DATA_API_AUTH_PRIVILEGES_MIGRATION_ID,
  CHAT_POSTGRES_DATA_API_AUTH_PRIVILEGES_SQL,
  CHAT_POSTGRES_DATA_API_AUTH_SQL,
} from "../chat-postgres-data-api-auth"

describe("chat-postgres-data-api-auth", () => {
  it("uses the Managed Auth JWT subject with a private-app fallback", () => {
    expect(CHAT_POSTGRES_DATA_API_AUTH_MIGRATION_ID).toBe(
      "20260720_pi_data_api_auth_rls"
    )
    expect(CHAT_POSTGRES_DATA_API_AUTH_SQL).toContain(
      "EXECUTE 'SELECT auth.user_id()'"
    )
    expect(CHAT_POSTGRES_DATA_API_AUTH_SQL).toContain(
      "current_setting('app.current_user_id', true)"
    )
    expect(CHAT_POSTGRES_DATA_API_AUTH_SQL).toContain(
      "(SELECT public.fleet_pi_current_user_id())"
    )
  })

  it("grants the authenticated role only non-secret application access", () => {
    expect(CHAT_POSTGRES_DATA_API_AUTH_SQL).toContain("GRANT SELECT ON TABLE")
    expect(CHAT_POSTGRES_DATA_API_AUTH_SQL).toContain(
      "GRANT INSERT, UPDATE, DELETE ON TABLE public.pi_user_settings TO authenticated"
    )
    expect(CHAT_POSTGRES_DATA_API_AUTH_SQL).toContain(
      "public.pi_user_providers,"
    )
    expect(CHAT_POSTGRES_DATA_API_AUTH_SQL).toContain("FROM authenticated")
    expect(CHAT_POSTGRES_DATA_API_AUTH_SQL).toContain("FROM anonymous")
  })

  it("keeps the managed auth lookup behind a fixed security-definer bridge", () => {
    expect(CHAT_POSTGRES_DATA_API_AUTH_SQL).toContain("SECURITY DEFINER")
    expect(CHAT_POSTGRES_DATA_API_AUTH_PRIVILEGES_MIGRATION_ID).toBe(
      "20260720_pi_data_api_auth_privileges"
    )
    expect(CHAT_POSTGRES_DATA_API_AUTH_PRIVILEGES_SQL).toContain(
      "ALTER FUNCTION public.fleet_pi_current_user_id() SECURITY DEFINER"
    )
    expect(CHAT_POSTGRES_DATA_API_AUTH_DEFINER_MIGRATION_ID).toBe(
      "20260720_pi_data_api_auth_definer"
    )
    expect(CHAT_POSTGRES_DATA_API_AUTH_DEFINER_SQL).toContain(
      "REVOKE ALL ON FUNCTION public.fleet_pi_current_user_id() FROM PUBLIC"
    )
  })
})
