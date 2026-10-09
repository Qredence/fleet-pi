import { describe, expect, it } from "vitest"
import { CHAT_POSTGRES_APP_ROLE_GRANTS_SQL } from "../chat-postgres-app-role-grants"

describe("chat-postgres-app-role-grants", () => {
  it("is guarded on the fleet_pi_app role existing", () => {
    expect(CHAT_POSTGRES_APP_ROLE_GRANTS_SQL).toContain(
      "IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app')"
    )
  })

  it("re-asserts the runtime grants the app role needs", () => {
    expect(CHAT_POSTGRES_APP_ROLE_GRANTS_SQL).toContain(
      "GRANT USAGE ON SCHEMA public TO fleet_pi_app"
    )
    for (const table of [
      "pi_sessions",
      "pi_session_entries",
      "pi_runs",
      "pi_run_events",
      "pi_tool_executions",
      "pi_file_mutations",
      "pi_user_providers",
      "pi_user_settings",
    ]) {
      expect(CHAT_POSTGRES_APP_ROLE_GRANTS_SQL).toContain(`public.${table}`)
    }
    expect(CHAT_POSTGRES_APP_ROLE_GRANTS_SQL).toContain(
      "GRANT SELECT, INSERT ON TABLE public.pi_session_tombstones TO fleet_pi_app"
    )
    expect(CHAT_POSTGRES_APP_ROLE_GRANTS_SQL).toContain(
      "public.fleet_pi_check_session_owner(TEXT, TEXT)"
    )
  })

  it("never grants the app role access to the migration ledger", () => {
    expect(CHAT_POSTGRES_APP_ROLE_GRANTS_SQL).not.toContain(
      "fleet_pi_chat_migrations"
    )
  })
})
