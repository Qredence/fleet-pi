/**
 * Idempotent Neon Data API privilege reconciliation, run on EVERY
 * `pnpm chat:migrate` (not ledger-gated). Runs last, after the base schema,
 * the CREATE OR REPLACE function reconciles, FORCE RLS, and the app-role
 * grants.
 *
 * Why the ledger-gated revokes are not enough: with Data API enabled, Neon
 * sets default privileges for `neondb_owner` in `public` that grant
 * `authenticated` DML on new tables, USAGE on new sequences, and EXECUTE on
 * new functions. Any later CREATE TABLE / CREATE FUNCTION re-grants those
 * roles, and the numbered revoke migrations
 * (`20260719_revoke_data_api_pi_grants`,
 * `20260719_revoke_ownership_probe_execute`,
 * `20260723_revoke_data_api_pi_grants_again`) are skipped once recorded, so
 * the grants stay. This step:
 *
 * 1. drops the legacy `fleet_pi_chat_migrations_read_only` policy;
 * 2. revokes `neondb_owner`'s public-schema default privileges on tables,
 *    sequences, and functions from `authenticated` / `anonymous` (other
 *    defaults, e.g. cloud_admin -> neon_superuser, are left alone);
 * 3. revokes all privileges on `public.pi_%` / `public.fleet_pi_%` tables,
 *    views, and sequences from `authenticated` / `anonymous` (never the whole
 *    public schema);
 * 4. revokes all privileges on `public.fleet_pi_%` functions from
 *    `authenticated`, `anonymous`, and PUBLIC;
 * 5. re-grants EXECUTE on those functions to the app role (`fleet_pi_app`,
 *    rewritten to FLEET_PI_APP_ROLE by `withAppRole`).
 *
 * Every step is guarded on the roles existing, so it is a no-op on plain
 * Postgres (no Data API roles) and safe to re-run.
 */
export const CHAT_POSTGRES_DATA_API_REVOKE_RECONCILE_SQL = `
DROP POLICY IF EXISTS fleet_pi_chat_migrations_read_only ON public.fleet_pi_chat_migrations;

DO $$
DECLARE
  target text;
  r record;
  owner_can_alter boolean := false;
BEGIN
  -- ALTER DEFAULT PRIVILEGES FOR ROLE needs membership in that role; the
  -- pg_has_role call errors on a missing role, so check existence first.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neondb_owner') THEN
    owner_can_alter := pg_has_role(current_user, 'neondb_owner', 'MEMBER');
  END IF;

  FOREACH target IN ARRAY ARRAY['authenticated', 'anonymous'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target) THEN
      CONTINUE;
    END IF;

    IF owner_can_alter THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public REVOKE ALL ON TABLES FROM %I', target);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', target);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', target);
    END IF;

    FOR r IN
      SELECT c.relname, c.relkind
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
        AND (c.relname LIKE 'pi\\_%' OR c.relname LIKE 'fleet\\_pi\\_%')
    LOOP
      IF r.relkind = 'S' THEN
        EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM %I', r.relname, target);
      ELSE
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', r.relname, target);
      END IF;
    END LOOP;

    FOR r IN
      SELECT p.oid::regprocedure AS signature
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prokind IN ('f', 'p')
        AND p.proname LIKE 'fleet\\_pi\\_%'
    LOOP
      EXECUTE format('REVOKE ALL ON ROUTINE %s FROM %I', r.signature, target);
    END LOOP;
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND p.proname LIKE 'fleet\\_pi\\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON ROUTINE %s FROM PUBLIC', r.signature);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_pi_app') THEN
      EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO %I', r.signature, 'fleet_pi_app');
    END IF;
  END LOOP;
END $$;
`
