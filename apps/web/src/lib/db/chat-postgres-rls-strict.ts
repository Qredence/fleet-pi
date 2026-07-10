export const CHAT_POSTGRES_RLS_STRICT_MIGRATION_ID =
  "20260709_pi_sessions_rls_strict"

const SESSION_OWNER_MATCH =
  "pi_sessions.user_id = current_setting('app.current_user_id', true)"

export const CHAT_POSTGRES_RLS_STRICT_SQL = `
DROP POLICY IF EXISTS pi_sessions_user_isolation ON pi_sessions;
CREATE POLICY pi_sessions_user_isolation ON pi_sessions
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS pi_session_entries_user_isolation ON pi_session_entries;
CREATE POLICY pi_session_entries_user_isolation ON pi_session_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pi_sessions
      WHERE pi_sessions.id = pi_session_entries.session_id
        AND (${SESSION_OWNER_MATCH})
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pi_sessions
      WHERE pi_sessions.id = pi_session_entries.session_id
        AND (${SESSION_OWNER_MATCH})
    )
  );

DROP POLICY IF EXISTS pi_runs_user_isolation ON pi_runs;
CREATE POLICY pi_runs_user_isolation ON pi_runs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pi_sessions
      WHERE pi_sessions.id = pi_runs.session_id
        AND (${SESSION_OWNER_MATCH})
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pi_sessions
      WHERE pi_sessions.id = pi_runs.session_id
        AND (${SESSION_OWNER_MATCH})
    )
  );

DROP POLICY IF EXISTS pi_run_events_user_isolation ON pi_run_events;
CREATE POLICY pi_run_events_user_isolation ON pi_run_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pi_runs
      JOIN pi_sessions ON pi_sessions.id = pi_runs.session_id
      WHERE pi_runs.id = pi_run_events.run_id
        AND (${SESSION_OWNER_MATCH})
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pi_runs
      JOIN pi_sessions ON pi_sessions.id = pi_runs.session_id
      WHERE pi_runs.id = pi_run_events.run_id
        AND (${SESSION_OWNER_MATCH})
    )
  );

DROP POLICY IF EXISTS pi_tool_executions_user_isolation ON pi_tool_executions;
CREATE POLICY pi_tool_executions_user_isolation ON pi_tool_executions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pi_sessions
      WHERE pi_sessions.id = pi_tool_executions.session_id
        AND (${SESSION_OWNER_MATCH})
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pi_sessions
      WHERE pi_sessions.id = pi_tool_executions.session_id
        AND (${SESSION_OWNER_MATCH})
    )
  );

DROP POLICY IF EXISTS pi_file_mutations_user_isolation ON pi_file_mutations;
CREATE POLICY pi_file_mutations_user_isolation ON pi_file_mutations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pi_runs
      JOIN pi_sessions ON pi_sessions.id = pi_runs.session_id
      WHERE pi_runs.id = pi_file_mutations.run_id
        AND (${SESSION_OWNER_MATCH})
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pi_runs
      JOIN pi_sessions ON pi_sessions.id = pi_runs.session_id
      WHERE pi_runs.id = pi_file_mutations.run_id
        AND (${SESSION_OWNER_MATCH})
    )
  );
`
