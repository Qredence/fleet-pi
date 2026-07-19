export const CHAT_POSTGRES_DATA_API_REVOKE_MIGRATION_ID =
  "20260719_revoke_data_api_pi_grants"

/**
 * Historical safety migration. The follow-up Data API auth migration replaces
 * these broad revokes with explicit authenticated grants backed by
 * `fleet_pi_current_user_id()` / Neon `auth.user_id()` RLS, while retaining
 * server-only treatment for BYOK secrets and migration bookkeeping.
 */
export const CHAT_POSTGRES_DATA_API_REVOKE_SQL = `
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
`
