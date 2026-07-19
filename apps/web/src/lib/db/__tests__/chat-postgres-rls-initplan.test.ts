import { describe, expect, it } from "vitest"
import {
  CHAT_POSTGRES_RLS_INITPLAN_MIGRATION_ID,
  CHAT_POSTGRES_RLS_INITPLAN_SQL,
} from "../chat-postgres-rls-initplan"

describe("chat-postgres-rls-initplan", () => {
  it("uses a dated migration id", () => {
    expect(CHAT_POSTGRES_RLS_INITPLAN_MIGRATION_ID).toBe(
      "20260719_pi_rls_initplan"
    )
  })

  it("wraps current_setting in a SELECT subquery for InitPlan", () => {
    expect(CHAT_POSTGRES_RLS_INITPLAN_SQL).toContain(
      "(SELECT current_setting('app.current_user_id', true))"
    )
    expect(CHAT_POSTGRES_RLS_INITPLAN_SQL).not.toMatch(
      /USING \(user_id = current_setting\('app\.current_user_id'/
    )
  })

  it("recreates isolation policies for all user-scoped pi tables", () => {
    for (const policy of [
      "pi_sessions_user_isolation",
      "pi_session_entries_user_isolation",
      "pi_runs_user_isolation",
      "pi_run_events_user_isolation",
      "pi_tool_executions_user_isolation",
      "pi_file_mutations_user_isolation",
      "pi_user_providers_isolation",
      "pi_user_settings_isolation",
      "pi_session_tombstones_user_isolation",
    ]) {
      expect(CHAT_POSTGRES_RLS_INITPLAN_SQL).toContain(policy)
    }
  })
})
