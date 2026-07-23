export const CHAT_POSTGRES_FORCE_RLS_MIGRATION_ID =
  "20260723_pi_force_row_level_security"

/**
 * Table owners (migration URLs) bypass RLS unless FORCE is set. Runtime must
 * use non-owner `fleet_pi_app`; FORCE makes accidental owner-as-app URLs still
 * enforce policies for that role when it is not a superuser bypass.
 *
 * Does not change policy expressions. Safe/idempotent.
 */
export const CHAT_POSTGRES_FORCE_RLS_SQL = `
ALTER TABLE IF EXISTS public.pi_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_session_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_session_tombstones FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_run_events FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_tool_executions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_file_mutations FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_user_providers FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pi_user_settings FORCE ROW LEVEL SECURITY;
`
