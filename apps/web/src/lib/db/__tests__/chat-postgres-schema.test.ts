import { describe, expect, it } from "vitest"
import { CHAT_POSTGRES_SCHEMA_SQL } from "../chat-postgres-schema"

describe("chat postgres schema ordering", () => {
  it("creates protected tables before enabling RLS or policies that reference them", () => {
    expectCreateBeforeReference(
      "pi_sessions",
      "ALTER TABLE IF EXISTS pi_sessions ENABLE ROW LEVEL SECURITY;"
    )
    expectCreateBeforeReference(
      "pi_sessions",
      "CREATE POLICY pi_sessions_user_isolation ON pi_sessions"
    )
    expectCreateBeforeReference(
      "pi_user_providers",
      "ALTER TABLE IF EXISTS pi_user_providers ENABLE ROW LEVEL SECURITY;"
    )
    expectCreateBeforeReference(
      "pi_user_providers",
      "CREATE POLICY pi_user_providers_isolation ON pi_user_providers"
    )
    expectCreateBeforeReference(
      "pi_user_providers",
      "UPDATE pi_user_providers a"
    )
    expectCreateBeforeReference(
      "pi_user_providers",
      "DELETE FROM pi_user_providers WHERE provider_id = 'google-genai';"
    )
    expect(CHAT_POSTGRES_SCHEMA_SQL).toContain(
      "auth_type TEXT NOT NULL DEFAULT 'apiKey'"
    )
    expect(CHAT_POSTGRES_SCHEMA_SQL).toContain("encrypted_payload TEXT NULL")
    expectCreateBeforeReference(
      "pi_session_entries",
      "ALTER TABLE IF EXISTS pi_session_entries ENABLE ROW LEVEL SECURITY;"
    )
    expectCreateBeforeReference(
      "pi_session_entries",
      "CREATE POLICY pi_session_entries_user_isolation ON pi_session_entries"
    )
    expectCreateBeforeReference(
      "pi_runs",
      "ALTER TABLE IF EXISTS pi_runs ENABLE ROW LEVEL SECURITY;"
    )
    expectCreateBeforeReference(
      "pi_runs",
      "CREATE POLICY pi_runs_user_isolation ON pi_runs"
    )
    expectCreateBeforeReference(
      "pi_run_events",
      "ALTER TABLE IF EXISTS pi_run_events ENABLE ROW LEVEL SECURITY;"
    )
    expectCreateBeforeReference(
      "pi_run_events",
      "CREATE POLICY pi_run_events_user_isolation ON pi_run_events"
    )
    expectCreateBeforeReference(
      "pi_tool_executions",
      "ALTER TABLE IF EXISTS pi_tool_executions ENABLE ROW LEVEL SECURITY;"
    )
    expectCreateBeforeReference(
      "pi_tool_executions",
      "CREATE POLICY pi_tool_executions_user_isolation ON pi_tool_executions"
    )
    expectCreateBeforeReference(
      "pi_file_mutations",
      "ALTER TABLE IF EXISTS pi_file_mutations ENABLE ROW LEVEL SECURITY;"
    )
    expectCreateBeforeReference(
      "pi_file_mutations",
      "CREATE POLICY pi_file_mutations_user_isolation ON pi_file_mutations"
    )
  })
})

function expectCreateBeforeReference(tableName: string, reference: string) {
  const createIndex = CHAT_POSTGRES_SCHEMA_SQL.indexOf(
    `CREATE TABLE IF NOT EXISTS ${tableName} (`
  )
  const referenceIndex = CHAT_POSTGRES_SCHEMA_SQL.indexOf(reference)

  expect(createIndex).toBeGreaterThanOrEqual(0)
  expect(referenceIndex).toBeGreaterThanOrEqual(0)
  expect(createIndex).toBeLessThan(referenceIndex)
}
