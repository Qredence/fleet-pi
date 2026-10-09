/**
 * Idempotent `fleet_pi_app` privilege reconciliation, run on EVERY
 * `pnpm chat:migrate` (not ledger-gated).
 *
 * The per-table grants live inside individual ledger migrations, each guarded
 * by `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app')`. When
 * the role is created after those migrations were recorded (new Neon project,
 * or a branch cut before the role existed), the grants are silently skipped
 * and the app role hits `permission denied` (42501) at runtime. Re-asserting
 * the canonical grant set each run closes that gap; GRANT is a no-op when the
 * privilege already exists.
 *
 * Mirrors the live production grant set: full DML on the owner-bound pi_*
 * tables, append-only tombstones, and EXECUTE on the ownership helpers. No
 * grants on fleet_pi_chat_migrations.
 */
export const CHAT_POSTGRES_APP_ROLE_GRANTS_SQL = `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
    GRANT USAGE ON SCHEMA public TO fleet_pi_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      public.pi_sessions,
      public.pi_session_entries,
      public.pi_runs,
      public.pi_run_events,
      public.pi_tool_executions,
      public.pi_file_mutations,
      public.pi_user_providers,
      public.pi_user_settings
    TO fleet_pi_app;
    GRANT SELECT, INSERT ON TABLE public.pi_session_tombstones TO fleet_pi_app;
    GRANT EXECUTE ON FUNCTION
      public.fleet_pi_check_session_owner(TEXT, TEXT),
      public.fleet_pi_lookup_session_id_by_file(TEXT)
    TO fleet_pi_app;
  END IF;
END $$;
`
