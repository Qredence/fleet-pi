export const CHAT_POSTGRES_RLS_INITPLAN_MIGRATION_ID =
  "20260719_pi_rls_initplan"

/**
 * Wrap `current_setting(...)` in `(SELECT ...)` so Postgres evaluates the
 * GUC once per query (InitPlan) instead of per row. Clears Neon Data Advisor
 * `auth_rls_initplan` warnings without changing isolation semantics.
 */
const CURRENT_USER_ID = "(SELECT current_setting('app.current_user_id', true))"

const SESSION_OWNER_MATCH = `pi_sessions.user_id = ${CURRENT_USER_ID}`

export const CHAT_POSTGRES_RLS_INITPLAN_SQL = `
DROP POLICY IF EXISTS pi_sessions_user_isolation ON pi_sessions;
CREATE POLICY pi_sessions_user_isolation ON pi_sessions
  FOR ALL
  USING (user_id = ${CURRENT_USER_ID})
  WITH CHECK (user_id = ${CURRENT_USER_ID});

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

DROP POLICY IF EXISTS pi_user_providers_isolation ON pi_user_providers;
CREATE POLICY pi_user_providers_isolation ON pi_user_providers
  FOR ALL
  USING (user_id = ${CURRENT_USER_ID})
  WITH CHECK (user_id = ${CURRENT_USER_ID});

DROP POLICY IF EXISTS pi_user_settings_isolation ON pi_user_settings;
CREATE POLICY pi_user_settings_isolation ON pi_user_settings
  FOR ALL
  USING (user_id = ${CURRENT_USER_ID})
  WITH CHECK (user_id = ${CURRENT_USER_ID});

DROP POLICY IF EXISTS pi_session_tombstones_user_isolation ON pi_session_tombstones;
CREATE POLICY pi_session_tombstones_user_isolation ON pi_session_tombstones
  FOR ALL
  USING (user_id = ${CURRENT_USER_ID})
  WITH CHECK (user_id = ${CURRENT_USER_ID});

-- Neon SQL Editor helper; pin search_path so Data Advisor stops flagging it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'show_db_tree'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.show_db_tree() SET search_path = pg_catalog, public';
  END IF;
END $$;
`
