export const CHAT_POSTGRES_DATA_API_AUTH_MIGRATION_ID =
  "20260720_pi_data_api_auth_rls"

/**
 * Align the chat mirror with Neon's Data API contract:
 * - authenticated requests are identified by auth.user_id() from the JWT;
 * - the existing app.current_user_id path remains available for the private
 *   fleet_pi_app connection and self-hosted Better Auth deployments;
 * - BYOK provider payloads and migration bookkeeping stay server-only.
 *
 * The helper uses a dynamic call because the legacy self-hosted deployment
 * does not have Neon's auth schema. On Managed Auth branches the first branch
 * is always used, so every RLS decision is bound to the Data API JWT subject.
 */
export const CHAT_POSTGRES_DATA_API_AUTH_SQL = `
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT ON TABLE
      public.pi_sessions,
      public.pi_session_entries,
      public.pi_runs,
      public.pi_run_events,
      public.pi_tool_executions,
      public.pi_file_mutations,
      public.pi_user_settings
    TO authenticated;
    GRANT INSERT, UPDATE, DELETE ON TABLE public.pi_user_settings TO authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

    -- Provider payloads, tombstones, and migration bookkeeping are private
    -- server tables even though they live in the Data API's public schema.
    REVOKE ALL ON TABLE
      public.pi_user_providers,
      public.pi_session_tombstones,
      public.fleet_pi_chat_migrations
    FROM authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    REVOKE ALL ON TABLE
      public.pi_sessions,
      public.pi_session_entries,
      public.pi_runs,
      public.pi_run_events,
      public.pi_tool_executions,
      public.pi_file_mutations,
      public.pi_user_providers,
      public.pi_user_settings,
      public.pi_session_tombstones,
      public.fleet_pi_chat_migrations
    FROM anonymous;
  END IF;
END $$;
`

/**
 * The first version of this migration may already be recorded on a branch.
 * Keep the function security repair separately replayable for those branches.
 */
export const CHAT_POSTGRES_DATA_API_AUTH_PRIVILEGES_MIGRATION_ID =
  "20260720_pi_data_api_auth_privileges"

export const CHAT_POSTGRES_DATA_API_AUTH_PRIVILEGES_SQL = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fleet_pi_current_user_id'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    ALTER FUNCTION public.fleet_pi_current_user_id() SECURITY DEFINER;
  END IF;
END $$;
`

export const CHAT_POSTGRES_DATA_API_AUTH_DEFINER_MIGRATION_ID =
  "20260720_pi_data_api_auth_definer"

export const CHAT_POSTGRES_DATA_API_AUTH_DEFINER_SQL = `
ALTER FUNCTION public.fleet_pi_current_user_id() SECURITY DEFINER;
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
`
