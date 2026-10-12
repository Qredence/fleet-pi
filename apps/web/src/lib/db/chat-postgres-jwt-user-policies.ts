export const CHAT_POSTGRES_JWT_USER_POLICIES_MIGRATION_ID =
  "20261009_pi_jwt_user_policies"

/**
 * Bind every pi_* RLS policy to `fleet_pi_current_user_id()`, which resolves
 * the Neon Auth JWT subject (`auth.user_id()`, Data API requests) first and
 * falls back to the transaction-scoped `app.current_user_id` used by the
 * server's `fleet_pi_app` connection. Without it, a Data API request (no
 * `app.current_user_id`) can never match a row.
 *
 * Deliberately grants NO table privileges to `authenticated`/`anonymous`:
 * the canonical access path stays `fleet_pi_app` (see
 * chat-postgres-data-api-revoke-again.ts). Exposing a table through the Data
 * API is a separate, explicit grant; these policies then scope it per user.
 * Idempotent (CREATE OR REPLACE, DROP POLICY IF EXISTS).
 */
export const CHAT_POSTGRES_JWT_USER_POLICIES_SQL = `
CREATE OR REPLACE FUNCTION public.fleet_pi_current_user_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  jwt_user_id TEXT;
BEGIN
  IF to_regprocedure('auth.user_id()') IS NOT NULL THEN
    EXECUTE 'SELECT auth.user_id()' INTO jwt_user_id;
    IF jwt_user_id IS NOT NULL AND jwt_user_id <> '' THEN
      RETURN jwt_user_id;
    END IF;
  END IF;

  RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$function$;

REVOKE ALL ON FUNCTION public.fleet_pi_current_user_id() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.fleet_pi_current_user_id() TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    GRANT EXECUTE ON FUNCTION public.fleet_pi_current_user_id() TO fleet_pi_app;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.pi_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_session_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_file_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_user_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_session_tombstones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pi_sessions_user_isolation ON public.pi_sessions;
CREATE POLICY pi_sessions_user_isolation ON public.pi_sessions
  FOR ALL
  USING (user_id = (SELECT public.fleet_pi_current_user_id()))
  WITH CHECK (user_id = (SELECT public.fleet_pi_current_user_id()));

DROP POLICY IF EXISTS pi_session_entries_user_isolation ON public.pi_session_entries;
CREATE POLICY pi_session_entries_user_isolation ON public.pi_session_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pi_sessions
      WHERE public.pi_sessions.id = public.pi_session_entries.session_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pi_sessions
      WHERE public.pi_sessions.id = public.pi_session_entries.session_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  );

DROP POLICY IF EXISTS pi_runs_user_isolation ON public.pi_runs;
CREATE POLICY pi_runs_user_isolation ON public.pi_runs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pi_sessions
      WHERE public.pi_sessions.id = public.pi_runs.session_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pi_sessions
      WHERE public.pi_sessions.id = public.pi_runs.session_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  );

DROP POLICY IF EXISTS pi_run_events_user_isolation ON public.pi_run_events;
CREATE POLICY pi_run_events_user_isolation ON public.pi_run_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.pi_runs
      JOIN public.pi_sessions ON public.pi_sessions.id = public.pi_runs.session_id
      WHERE public.pi_runs.id = public.pi_run_events.run_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pi_runs
      JOIN public.pi_sessions ON public.pi_sessions.id = public.pi_runs.session_id
      WHERE public.pi_runs.id = public.pi_run_events.run_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  );

DROP POLICY IF EXISTS pi_tool_executions_user_isolation ON public.pi_tool_executions;
CREATE POLICY pi_tool_executions_user_isolation ON public.pi_tool_executions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pi_sessions
      WHERE public.pi_sessions.id = public.pi_tool_executions.session_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pi_sessions
      WHERE public.pi_sessions.id = public.pi_tool_executions.session_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  );

DROP POLICY IF EXISTS pi_file_mutations_user_isolation ON public.pi_file_mutations;
CREATE POLICY pi_file_mutations_user_isolation ON public.pi_file_mutations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.pi_runs
      JOIN public.pi_sessions ON public.pi_sessions.id = public.pi_runs.session_id
      WHERE public.pi_runs.id = public.pi_file_mutations.run_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pi_runs
      JOIN public.pi_sessions ON public.pi_sessions.id = public.pi_runs.session_id
      WHERE public.pi_runs.id = public.pi_file_mutations.run_id
        AND public.pi_sessions.user_id = (SELECT public.fleet_pi_current_user_id())
    )
  );

DROP POLICY IF EXISTS pi_user_providers_isolation ON public.pi_user_providers;
CREATE POLICY pi_user_providers_isolation ON public.pi_user_providers
  FOR ALL
  USING (user_id = (SELECT public.fleet_pi_current_user_id()))
  WITH CHECK (user_id = (SELECT public.fleet_pi_current_user_id()));

DROP POLICY IF EXISTS pi_user_settings_isolation ON public.pi_user_settings;
CREATE POLICY pi_user_settings_isolation ON public.pi_user_settings
  FOR ALL
  USING (user_id = (SELECT public.fleet_pi_current_user_id()))
  WITH CHECK (user_id = (SELECT public.fleet_pi_current_user_id()));

DROP POLICY IF EXISTS pi_session_tombstones_user_isolation ON public.pi_session_tombstones;
CREATE POLICY pi_session_tombstones_user_isolation ON public.pi_session_tombstones
  FOR ALL
  USING (user_id = (SELECT public.fleet_pi_current_user_id()))
  WITH CHECK (user_id = (SELECT public.fleet_pi_current_user_id()));
`
