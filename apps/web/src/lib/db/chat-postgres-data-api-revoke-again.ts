export const CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_MIGRATION_ID =
  "20260723_revoke_data_api_pi_grants_again"

/**
 * Re-assert Fleet Pi's Data API posture after orphan live migrations
 * (`20260720_pi_data_api_auth_*`, absent from this repo) re-granted
 * `authenticated` privileges on `pi_*` tables.
 *
 * Canonical access path: `fleet_pi_app` + `app.current_user_id` (or
 * `fleet_pi_current_user_id()` when present) — not Neon Data API JWT roles.
 *
 * Supersedes the effect of:
 * - `20260719_pi_rls_initplan`
 * - `20260720_pi_data_api_auth_rls`
 * - `20260720_pi_data_api_auth_privileges`
 * - `20260720_pi_data_api_auth_definer`
 *
 * Idempotent: safe to re-run; does not drop `fleet_pi_current_user_id()` itself.
 */
export const CHAT_POSTGRES_DATA_API_REVOKE_AGAIN_SQL = `
DROP POLICY IF EXISTS fleet_pi_chat_migrations_read_only ON public.fleet_pi_chat_migrations;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.pi_sessions FROM authenticated;
    REVOKE ALL ON TABLE public.pi_session_entries FROM authenticated;
    REVOKE ALL ON TABLE public.pi_session_tombstones FROM authenticated;
    REVOKE ALL ON TABLE public.pi_runs FROM authenticated;
    REVOKE ALL ON TABLE public.pi_run_events FROM authenticated;
    REVOKE ALL ON TABLE public.pi_tool_executions FROM authenticated;
    REVOKE ALL ON TABLE public.pi_file_mutations FROM authenticated;
    REVOKE ALL ON TABLE public.pi_user_providers FROM authenticated;
    REVOKE ALL ON TABLE public.pi_user_settings FROM authenticated;
    REVOKE ALL ON TABLE public.fleet_pi_chat_migrations FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    REVOKE ALL ON TABLE public.pi_sessions FROM anonymous;
    REVOKE ALL ON TABLE public.pi_session_entries FROM anonymous;
    REVOKE ALL ON TABLE public.pi_session_tombstones FROM anonymous;
    REVOKE ALL ON TABLE public.pi_runs FROM anonymous;
    REVOKE ALL ON TABLE public.pi_run_events FROM anonymous;
    REVOKE ALL ON TABLE public.pi_tool_executions FROM anonymous;
    REVOKE ALL ON TABLE public.pi_file_mutations FROM anonymous;
    REVOKE ALL ON TABLE public.pi_user_providers FROM anonymous;
    REVOKE ALL ON TABLE public.pi_user_settings FROM anonymous;
    REVOKE ALL ON TABLE public.fleet_pi_chat_migrations FROM anonymous;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.fleet_pi_current_user_id()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.fleet_pi_current_user_id() FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON FUNCTION public.fleet_pi_current_user_id() FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
      REVOKE ALL ON FUNCTION public.fleet_pi_current_user_id() FROM anonymous;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
      GRANT EXECUTE ON FUNCTION public.fleet_pi_current_user_id() TO fleet_pi_app;
    END IF;
  END IF;
END $$;
`
